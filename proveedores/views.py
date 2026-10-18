from django.db import transaction
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Sum, Q
from django.utils import timezone
from pedidos.models import ServicioExterno
from .models import Proveedor
from finanzas.models import MovimientoCaja

def lista_proveedores(request):
    """Muestra el directorio de proveedores y cuánto se les debe."""
    proveedores = Proveedor.objects.filter(activo=True).order_by('nombre')
    
    # Calculamos la deuda total (servicios que no están pagados)
    for p in proveedores:
        p.deuda_total = p.servicioexterno_set.filter(estado__in=['SOLICITADO', 'RECIBIDO']).aggregate(total=Sum('monto'))['total'] or 0
        
    return render(request, 'proveedores/lista.html', {'proveedores': proveedores})


def cuentas_por_pagar(request):
    """Muestra todos los servicios pendientes de pago."""
    servicios = ServicioExterno.objects.filter(
        estado__in=['SOLICITADO', 'RECIBIDO']
    ).select_related('proveedor', 'pedido', 'pedido__libro').order_by('estado', 'fecha_solicitud')
    
    total_deuda = servicios.aggregate(total=Sum('monto'))['total'] or 0
    
    return render(request, 'proveedores/cuentas_por_pagar.html', {
        'servicios': servicios,
        'total_deuda': total_deuda
    })


def recibir_servicio(request, pk):
    """Marca un servicio como RECIBIDO (ej. ya tengo la portada en mis manos)."""
    servicio = get_object_or_404(ServicioExterno, pk=pk)
    if request.method == 'POST' and servicio.estado == 'SOLICITADO':
        servicio.estado = 'RECIBIDO'
        servicio.fecha_recepcion = timezone.now()
        servicio.save()
        messages.success(request, f'Servicio {servicio.get_tipo_display()} marcado como recibido.')
    return redirect('proveedores:cuentas_por_pagar')


def pagar_servicio(request, pk):
    """Registra el pago de un servicio y lo resta de la caja."""
    servicio = get_object_or_404(ServicioExterno, pk=pk)
    
    if request.method == 'POST' and servicio.estado != 'PAGADO':
        with transaction.atomic():
            # 1. Marcamos como pagado
            servicio.estado = 'PAGADO'
            servicio.fecha_pago = timezone.now()
            servicio.save()
            
            # 2. Registramos la salida de dinero en caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='PAGO_PROVEEDOR',
                monto=servicio.monto,
                concepto=f'Pago {servicio.get_tipo_display()} - Pedido #{servicio.pedido.id} ({servicio.proveedor.nombre})',
                proveedor=servicio.proveedor,
                pedido=servicio.pedido
            )
            messages.success(request, f'Pago de ${servicio.monto} registrado a {servicio.proveedor.nombre}.')
            
    return redirect('proveedores:cuentas_por_pagar')