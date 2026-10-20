from django.db import transaction
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Sum, Q
from django.utils import timezone
from finanzas.services import ServicioFinanzas
from pedidos.models import ServicioExterno
from pedidos.services import ServicioPedido
from .models import Proveedor
from finanzas.models import MovimientoCaja
from decimal import Decimal
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.db import transaction
from finanzas.models import MovimientoCaja

def lista_proveedores(request):
    """Muestra el directorio de proveedores y cuánto se les debe."""
    proveedores = Proveedor.objects.filter(activo=True).order_by('nombre')
    
    # Calculamos la deuda total (servicios que no están pagados)
    for p in proveedores:
        p.deuda_total = p.servicioexterno_set.filter(estado__in=['SOLICITADO', 'RECIBIDO']).aggregate(total=Sum('monto'))['total'] or 0
        
    return render(request, 'proveedores/lista.html', {'proveedores': proveedores})


def cuentas_por_pagar(request):
    servicios = ServicioExterno.objects.filter(
        estado__in=['SOLICITADO', 'RECIBIDO']
    ).select_related('proveedor', 'pedido', 'pedido__libro').order_by('pedido_id')
    
    total_deuda = servicios.aggregate(total=Sum('monto'))['total'] or 0
    saldo_caja = ServicioFinanzas.saldo_caja('CUP')
    
    return render(request, 'proveedores/cuentas_por_pagar.html', {
        'servicios': servicios,
        'total_deuda': total_deuda,
        'saldo_caja': saldo_caja,
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
                        # Verificar si el lote se completa
            if servicio.lote:
                ServicioPedido.verificar_y_cerrar_lote(servicio.lote)

            messages.success(request, f'Pago de ${servicio.monto} registrado a {servicio.proveedor.nombre}.')
            
    return redirect('proveedores:cuentas_por_pagar')

@require_POST
def recibir_lote(request):
    """Marca varios servicios como RECIBIDOS a la vez."""
    ids = request.POST.getlist('servicios_ids')
    if ids:
        with transaction.atomic():
            ServicioExterno.objects.filter(id__in=ids, estado='SOLICITADO').update(
                estado='RECIBIDO',
                fecha_recepcion=timezone.now()
            )
        messages.success(request, f'Se marcaron {len(ids)} servicios como recibidos.')
    else:
        messages.warning(request, 'No seleccionaste ningún servicio.')
    return redirect('proveedores:cuentas_por_pagar')

@require_POST
def pagar_lote(request):
    """Paga varios servicios a la vez y los resta de la caja."""
    ids = request.POST.getlist('servicios_ids')
    if ids:
        servicios = ServicioExterno.objects.filter(id__in=ids, estado__in=['SOLICITADO', 'RECIBIDO'])
        lotes_afectados = set()
        
        with transaction.atomic():
            total_pagado = 0
            
            for s in servicios:
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria='PAGO_PROVEEDOR',
                    monto=s.monto,
                    concepto=f'Pago {s.get_tipo_display()} - Pedido #{s.pedido.id} ({s.proveedor.nombre})',
                    proveedor=s.proveedor,
                    pedido=s.pedido
                )
                total_pagado += s.monto
                
                s.estado = 'PAGADO'
                s.fecha_pago = timezone.now()
                if not s.fecha_recepcion:
                    s.fecha_recepcion = timezone.now()
                s.save()
                
                if s.lote:
                    lotes_afectados.add(s.lote)
            
            # Verificar cada lote afectado
            for lote in lotes_afectados:
                ServicioPedido.verificar_y_cerrar_lote(lote)
                
        messages.success(request, f'Se pagaron {len(ids)} servicios por un total de ${total_pagado:.2f}.')
    else:
        messages.warning(request, 'No seleccionaste ningún servicio para pagar.')
    return redirect('proveedores:cuentas_por_pagar')

def editar_monto_servicio(request, pk):
    """Permite ajustar el monto real de un servicio externo."""
    servicio = get_object_or_404(ServicioExterno, pk=pk)
    
    if request.method == 'POST':
        nuevo_monto = Decimal(request.POST.get('monto', 0))
        if nuevo_monto > 0:
            servicio.monto = nuevo_monto
            servicio.save()
            messages.success(request, f'Monto actualizado a ${nuevo_monto}.')
        else:
            messages.error(request, 'El monto debe ser mayor a 0.')
            
    return redirect('proveedores:cuentas_por_pagar')