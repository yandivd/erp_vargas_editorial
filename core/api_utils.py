from django.core.paginator import Paginator
from django.http import JsonResponse


PER_PAGE_OPTIONS = (10, 25, 50)
PER_PAGE_DEFAULT = 10


def obtener_per_page(request):
    try:
        valor = int(request.GET.get('per_page', PER_PAGE_DEFAULT))
    except (TypeError, ValueError):
        valor = PER_PAGE_DEFAULT
    return valor if valor in PER_PAGE_OPTIONS else PER_PAGE_DEFAULT


def paginar(request, queryset, per_page=None):
    per_page = per_page or obtener_per_page(request)
    paginator = Paginator(queryset, per_page)
    return paginator, paginator.get_page(request.GET.get('page'))


def payload_paginacion(paginator, page_obj):
    page_range = list(
        paginator.get_elided_page_range(
            number=page_obj.number,
            on_each_side=2,
            on_ends=1,
        )
    )
    return {
        'page': page_obj.number,
        'per_page': paginator.per_page,
        'total': paginator.count,
        'num_pages': paginator.num_pages,
        'start_index': page_obj.start_index() if paginator.count else 0,
        'end_index': page_obj.end_index() if paginator.count else 0,
        'has_previous': page_obj.has_previous(),
        'has_next': page_obj.has_next(),
        'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
        'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
        'page_range': page_range,
        'per_page_options': list(PER_PAGE_OPTIONS),
    }


def respuesta_ok(data=None, pagination=None, meta=None):
    payload = {'ok': True}
    if data is not None:
        payload['data'] = data
    if pagination is not None:
        payload['pagination'] = pagination
    if meta is not None:
        payload['meta'] = meta
    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})


def respuesta_error(mensaje, status=400, errores=None):
    payload = {'ok': False, 'error': mensaje}
    if errores is not None:
        payload['errors'] = errores
    return JsonResponse(payload, status=status, json_dumps_params={'ensure_ascii': False})
