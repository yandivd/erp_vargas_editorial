from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from .models import OrdenCompra, DetalleCompra
from inventario.models import Material, MovimientoInventario, LoteConsumo
from finanzas.models import MovimientoCaja
from proveedores.models import Proveedor

def lista_compras(request):
    compras = OrdenCompra.objects.all().select_related('proveedor').order_by('-fecha')
    return render(request, 'compras/lista.html', {'compras': compras})

def nueva_compra(request):
    proveedores = Proveedor.objects.filter(activo=True)
    materiales = Material.objects.filter(activo=True)
    
    if request.method == 'POST':
        proveedor_id = request.POST.get('proveedor')
        notas = request.POST.get('notas', '')
        
        materiales_ids = request.POST.getlist('material_id[]')
        cantidades = request.POST.getlist('cantidad[]')
        costos = request.POST.getlist('costo[]')
        
        if not proveedor_id or not materiales_ids:
            messages.error(request, 'Debes seleccionar un proveedor y al menos un material.')
            return redirect('compras:nueva')
            
        proveedor = get_object_or_404(Proveedor, id=proveedor_id)
        
        with transaction.atomic():
            orden = OrdenCompra.objects.create(
                proveedor=proveedor,
                notas=notas,
                estado='BORRADOR' # <-- Nace en Borrador
            )
            
            total_orden = Decimal('0')
            for i in range(len(materiales_ids)):
                if not materiales_ids[i]: continue
                
                material = get_object_or_404(Material, id=materiales_ids[i])
                cantidad = Decimal(cantidades[i])
                costo_unitario = Decimal(costos[i])
                
                DetalleCompra.objects.create(
                    orden=orden,
                    material=material,
                    cantidad=cantidad,
                    costo_unitario=costo_unitario
                )
                total_orden += (cantidad * costo_unitario)
            
            orden.total = total_orden
            orden.save()
            
        messages.success(request, f'Orden OC-{orden.id:05d} creada en borrador. Imprímela y preséntala al proveedor.')
        return redirect('compras:imprimir', pk=orden.id)
        
    return render(request, 'compras/nueva.html', {
        'proveedores': proveedores,
        'materiales': materiales
    })

def recibir_compra(request, pk):
    """Aquí es donde se mete al inventario y se resta el dinero de la caja."""
    orden = get_object_or_404(OrdenCompra, pk=pk)
    
    if orden.estado != 'BORRADOR':
        messages.error(request, 'Esta orden ya fue procesada o cancelada.')
        return redirect('compras:lista')
        
    if request.method == 'POST':
        with transaction.atomic():
            # 1. Marcar como recibida
            orden.estado = 'RECIBIDA'
            orden.fecha_recepcion = timezone.now()
            orden.save()
            
            # 2. Meter al inventario los materiales
            for detalle in orden.detalles.all():
                material = detalle.material
                
                MovimientoInventario.objects.create(
                    material=material,
                    tipo='ENTRADA',
                    cantidad=detalle.cantidad,
                    costo_unitario=detalle.costo_unitario,
                    costo_total=detalle.subtotal,
                    motivo=f'Recepción OC-{orden.id:05d}'
                )
                
                # Crear Lotes
                if material.unidad_consumo:
                    total_lotes = int(detalle.cantidad * material.cantidad_por_unidad)
                    costo_por_lote = detalle.subtotal / total_lotes if total_lotes > 0 else 0
                    
                    ultimo_lote = LoteConsumo.objects.filter(material=material).order_by('-id').first()
                    contador = 1
                    if ultimo_lote and '-' in ultimo_lote.codigo:
                        try:
                            contador = int(ultimo_lote.codigo.split('-')[1]) + 1
                        except: pass
                    
                    lotes_a_crear = []
                    prefijo = material.nombre[:4].upper().replace(" ", "")
                    for _ in range(total_lotes):
                        lotes_a_crear.append(LoteConsumo(
                            material=material, codigo=f"{prefijo}-{contador:03d}",
                            cantidad_inicial=1, cantidad_actual=1,
                            costo_total=costo_por_lote, estado='CERRADO'
                        ))
                        contador += 1
                    LoteConsumo.objects.bulk_create(lotes_a_crear)
                    material.stock_consumo += total_lotes
                    material.save()
            
            # 3. Restar el dinero de la caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='COMPRA_MATERIAL',
                monto=orden.total,
                concepto=f'Pago OC-{orden.id:05d} a {orden.proveedor.nombre}',
                proveedor=orden.proveedor
            )
            
        messages.success(request, f'Orden OC-{orden.id:05d} recibida. Inventario y Caja actualizados.')
        return redirect('compras:lista')
        
    return render(request, 'compras/recibir.html', {'orden': orden})

def cancelar_compra(request, pk):
    orden = get_object_or_404(OrdenCompra, pk=pk)
    if orden.estado == 'BORRADOR' and request.method == 'POST':
        orden.estado = 'CANCELADA'
        orden.save()
        messages.warning(request, f'Orden OC-{orden.id:05d} cancelada. No afectó inventario ni caja.')
    return redirect('compras:lista')

def imprimir_compra(request, pk):
    orden = get_object_or_404(OrdenCompra, pk=pk)
    return render(request, 'compras/imprimir.html', {'orden': orden})