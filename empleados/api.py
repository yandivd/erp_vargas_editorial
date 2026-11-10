from core.api_utils import payload_paginacion, paginar, respuesta_ok
from empleados.models import Empleado, PagoNomina


def api_empleados(request):
    empleados = Empleado.objects.all().order_by('nombre')
    paginator, page_obj = paginar(request, empleados, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': e.id,
            'nombre': e.nombre,
            'cargo': e.cargo,
            'cargo_label': e.get_cargo_display(),
            'telefono': e.telefono or '',
            'salario_base': float(e.salario_base),
            'activo': e.activo,
        }
        for e in page_obj
    ]

    return respuesta_ok(
        data={'empleados': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_empleados': paginator.count},
    )


def api_pagos(request):
    pagos = PagoNomina.objects.all().order_by('-fecha')
    paginator, page_obj = paginar(request, pagos, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': p.id,
            'empleado_nombre': p.empleado.nombre,
            'tipo': p.tipo,
            'tipo_label': p.get_tipo_display(),
            'fecha': p.fecha.strftime('%d/%m/%Y'),
            'mes_correspondiente': p.mes_correspondiente,
            'monto_pagado': float(p.monto_pagado),
            'moneda': p.moneda,
            'moneda_label': p.get_moneda_display(),
            'tasa_aplicada': float(p.tasa_aplicada) if p.tasa_aplicada else None,
            'notas': p.notas or '',
        }
        for p in page_obj
    ]

    return respuesta_ok(
        data={'pagos': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_pagos': paginator.count},
    )
