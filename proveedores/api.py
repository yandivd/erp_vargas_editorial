from django.db.models import Sum, Q
from core.api_utils import payload_paginacion, paginar, respuesta_ok
from proveedores.models import Proveedor

def api_proveedores(request):
    # CORRECCIÓN AQUÍ: Usamos filter=Q(...) en lugar de filter__...
    proveedores = Proveedor.objects.annotate(
        deuda_total=Sum(
            'servicioexterno__monto',
            filter=Q(servicioexterno__estado__in=['SOLICITADO', 'RECIBIDO']),
        )
    ).order_by('nombre')

    paginator, page_obj = paginar(request, proveedores, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': p.id,
            'nombre': p.nombre,
            'tipo': p.tipo,
            'tipo_label': p.get_tipo_display(),
            'telefono': p.telefono or '',
            'direccion': p.direccion or '',
            'notas': p.notas or '',
            'activo': p.activo,
            'deuda_total': float(p.deuda_total or 0),
        }
        for p in page_obj
    ]

    return respuesta_ok(
        data={'proveedores': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_proveedores': paginator.count},
    )