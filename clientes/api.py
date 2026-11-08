from django.db.models import Count, Q, Sum

from core.api_utils import payload_paginacion, paginar, respuesta_ok
from clientes.models import Cliente


ORDERS_EXCLUDED = ['Entregado', 'Cancelado']


def _obtener_clientes(request):
    orden = request.GET.get('orden', 'nombre_asc')
    nombre = request.GET.get('nombre', '').strip()
    telefono = request.GET.get('telefono', '').strip()
    deuda = request.GET.get('deuda', '')

    clientes = Cliente.objects.annotate(
        pedidos_totales=Count(
            'pedidos',
            distinct=True,
            filter=~Q(pedidos__estado__nombre__in=ORDERS_EXCLUDED),
        ),
        saldo_pendiente_total_db=Sum(
            'pedidos__saldo_pendiente',
            filter=~Q(pedidos__estado__nombre__in=ORDERS_EXCLUDED),
        ),
    )
    if nombre:
        clientes = clientes.filter(nombre__icontains=nombre)
    if telefono:
        clientes = clientes.filter(telefono__icontains=telefono)
    if deuda == 'con_deuda':
        clientes = clientes.filter(saldo_pendiente_total_db__gt=0)
    elif deuda == 'al_dia':
        clientes = clientes.filter(saldo_pendiente_total_db=0)

    if orden == 'nombre_desc':
        clientes = clientes.order_by('-nombre')
    elif orden == 'pedidos_desc':
        clientes = clientes.order_by('-pedidos_totales', '-nombre')
    elif orden == 'pedidos_asc':
        clientes = clientes.order_by('pedidos_totales', 'nombre')
    else:
        clientes = clientes.order_by('nombre')

    return clientes


def api_lista_clientes(request):
    clientes_list = _obtener_clientes(request)
    paginator, page_obj = paginar(request, clientes_list, per_page=request.GET.get('per_page'))
    total = paginator.count

    clientes = []
    for c in page_obj:
        clientes.append({
            'id': c.id,
            'nombre': c.nombre,
            'telefono': c.telefono or '',
            'pedidos': c.pedidos_totales or 0,
            'saldo_pendiente': float(c.saldo_pendiente_total_db or 0),
        })

    return respuesta_ok(
        data={'clientes': clientes},
        pagination=payload_paginacion(paginator, page_obj),
        meta={
            'total_clientes': total,
            'filtros': {
                'nombre': request.GET.get('nombre', ''),
                'telefono': request.GET.get('telefono', ''),
                'deuda': request.GET.get('deuda', ''),
            },
        },
    )
