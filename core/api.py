from django.core.cache import cache
from django.http import JsonResponse
from django.shortcuts import render

from .services import (
    FECHA_CORTE_FINANCIERO,
    REFERENCIA_CORTE_FINANCIERO,
    dashboard_clientes,
    dashboard_produccion,
    dashboard_resumen,
    parse_fecha,
    tasa_cambio,
)


DASHBOARD_CACHE_VERSION = 5
DASHBOARD_CACHE_TTL = 300


def dashboard_page(request):
    return render(request, 'dashboard.html', {
        'desde': request.GET.get('desde', ''),
        'hasta': request.GET.get('hasta', ''),
    })


def _cache_key(tab, desde, hasta):
    tasa, _ = tasa_cambio()
    return (
        f'dashboard_api_v{DASHBOARD_CACHE_VERSION}_{tab}_'
        f'{desde or "todo"}_{hasta or "todo"}_{tasa}'
    )


def obtener_dashboard_data(tab, desde_str='', hasta_str=''):
    if tab not in ('resumen', 'produccion', 'clientes'):
        raise ValueError('Tab no válida')

    desde = parse_fecha(desde_str)
    hasta = parse_fecha(hasta_str)
    if desde and hasta and desde > hasta:
        desde, hasta = hasta, desde

    key = _cache_key(tab, desde_str, hasta_str)
    data = cache.get(key)
    
    if data is None:
        if tab == 'resumen':
            data = dashboard_resumen(desde, hasta)
        elif tab == 'produccion':
            data = dashboard_produccion(desde, hasta)
        else:
            data = dashboard_clientes(desde, hasta)

        data.setdefault('meta', {})
        data['meta'].update({
            'desde': desde_str,
            'hasta': hasta_str,
            'corte_financiero': FECHA_CORTE_FINANCIERO.isoformat(),
            'referencia_corte': REFERENCIA_CORTE_FINANCIERO,
        })
        cache.set(key, data, DASHBOARD_CACHE_TTL)

    return data


def dashboard_api(request):
    tab = request.GET.get('tab', 'resumen')
    try:
        data = obtener_dashboard_data(
            tab,
            request.GET.get('desde', ''),
            request.GET.get('hasta', ''),
        )
    except ValueError as error:
        return JsonResponse({'ok': False, 'error': str(error)}, status=400)

    return JsonResponse(
        {'ok': True, 'data': data},
        json_dumps_params={'ensure_ascii': False},
    )