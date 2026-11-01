from finanzas.models import MovimientoCaja
from core.api_utils import payload_paginacion, paginar, respuesta_ok


def api_movimientos_caja(request):
    movimientos = MovimientoCaja.objects.all().order_by('-fecha')

    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    categoria = request.GET.get('categoria', '')
    tipo = request.GET.get('tipo', '')

    if desde:
        movimientos = movimientos.filter(fecha__date__gte=desde)
    if hasta:
        movimientos = movimientos.filter(fecha__date__lte=hasta)
    if categoria:
        movimientos = movimientos.filter(categoria=categoria)
    if tipo:
        movimientos = movimientos.filter(tipo=tipo)

    paginator, page_obj = paginar(request, movimientos, per_page=request.GET.get('per_page'))
    data = []
    for m in page_obj:
        data.append({
            'id': m.id,
            'fecha': m.fecha.strftime('%d/%m/%Y %H:%M'),
            'tipo': m.tipo,
            'concepto': m.concepto,
            'categoria': m.categoria,
            'categoria_label': m.get_categoria_display(),
            'monto': float(m.monto),
            'moneda': m.moneda,
        })

    return respuesta_ok(
        data={'movimientos': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_movimientos': paginator.count},
    )
