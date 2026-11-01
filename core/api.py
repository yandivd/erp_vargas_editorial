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


DASHBOARD_CACHE_VERSION = 1
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


def dashboard_api(request):
    tab = request.GET.get('tab', 'resumen')
    if tab not in ('resumen', 'produccion', 'clientes'):
        return JsonResponse({'ok': False, 'error': 'Tab no válida'}, status=400)

    desde_str = request.GET.get('desde', '')    
    hasta_str = request.GET.get('hasta', '')
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

    return JsonResponse(
        {'ok': True, 'data': data},
        json_dumps_params={'ensure_ascii': False},
    )
