import time

from django.core.cache import cache
from django.http import JsonResponse
from django.shortcuts import render

from .services import (
    FECHA_CORTE_FINANCIERO,
    REFERENCIA_CORTE_FINANCIERO,
    dashboard_clientes,
    dashboard_fidelidad,
    dashboard_leads,
    dashboard_produccion,
    dashboard_resumen,
    normalizar_periodo,
    tasa_cambio,
)


DASHBOARD_CACHE_VERSION = 16
DASHBOARD_CACHE_TTL = 300


def dashboard_page(request):
    desde_str = request.GET.get('desde', '')
    hasta_str = request.GET.get('hasta', '')
    desde, hasta, modo = normalizar_periodo(
        desde_str, hasta_str, request.GET.get('modo', '')
    )
    return render(request, 'dashboard.html', {
        'desde': desde.isoformat() if desde else '',
        'hasta': hasta.isoformat() if hasta else '',
        'modo': modo,
    })


def _cache_key(tab, desde, hasta, modo):
    tasa, _ = tasa_cambio()
    desde_txt = desde.isoformat() if desde else 'todo'
    hasta_txt = hasta.isoformat() if hasta else 'todo'
    return (
        f'dashboard_api_v{DASHBOARD_CACHE_VERSION}_{tab}_'
        f'{desde_txt}_{hasta_txt}_{modo}_{tasa}'
    )


def _calcular_dashboard_data(tab, desde, hasta, modo):
    incluir_historial = modo == 'global'
    if tab == 'resumen':
        data = dashboard_resumen(
            desde, hasta, incluir_historial=incluir_historial
        )
    elif tab == 'produccion':
        data = dashboard_produccion(desde, hasta)
    elif tab == 'fidelidad':
        data = dashboard_fidelidad(desde, hasta)
    elif tab == 'leads':
        data = dashboard_leads(desde, hasta)
    else:
        data = dashboard_clientes(desde, hasta)

    data.setdefault('meta', {})
    data['meta'].update({
        'desde': desde.isoformat() if desde else '',
        'hasta': hasta.isoformat() if hasta else '',
        'modo': modo,
        'corte_financiero': FECHA_CORTE_FINANCIERO.isoformat(),
        'referencia_corte': REFERENCIA_CORTE_FINANCIERO,
    })
    return data


def obtener_dashboard_data(tab, desde_str='', hasta_str='', modo=''):
    if tab not in ('resumen', 'produccion', 'clientes', 'fidelidad', 'leads'):
        raise ValueError('Tab no válida')

    desde, hasta, modo = normalizar_periodo(desde_str, hasta_str, modo)

    key = _cache_key(tab, desde, hasta, modo)
    data = cache.get(key)
    if data is not None:
        return data

    lock_key = f'{key}:lock'
    if cache.add(lock_key, 1, 15):
        try:
            data = _calcular_dashboard_data(tab, desde, hasta, modo)
            cache.set(key, data, DASHBOARD_CACHE_TTL)
        finally:
            cache.delete(lock_key)
        return data

    for _ in range(10):
        time.sleep(0.05)
        data = cache.get(key)
        if data is not None:
            return data

    data = _calcular_dashboard_data(tab, desde, hasta, modo)
    cache.set(key, data, DASHBOARD_CACHE_TTL)
    return data


def dashboard_api(request):
    tab = request.GET.get('tab', 'resumen')
    try:
        data = obtener_dashboard_data(
            tab,
            request.GET.get('desde', ''),
            request.GET.get('hasta', ''),
            request.GET.get('modo', ''),
        )
    except ValueError as error:
        return JsonResponse({'ok': False, 'error': str(error)}, status=400)

    return JsonResponse(
        {'ok': True, 'data': data},
        json_dumps_params={'ensure_ascii': False},
    )