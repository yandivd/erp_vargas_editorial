from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import F
from decimal import Decimal

from .models import Material, MovimientoInventario
from finanzas.models import MovimientoCaja


def lista_inventario(request):
    """Muestra todos los materiales y su stock actual."""
    materiales = Material.objects.filter(activo=True).order_by('nombre')
    return render(request, 'inventario/lista.html', {'materiales': materiales})


def registrar_compra_modal(request):
    """Procesa la compra de un material desde el modal."""
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Método no permitido'}, status=405)
    
    try:
        material_id = request.POST.get('material_id')
        cantidad = Decimal(request.POST.get('cantidad', 0))
        costo_total = Decimal(request.POST.get('costo_total', 0))
        notas = request.POST.get('notas', '')
        
        if cantidad <= 0 or costo_total <= 0:
            return JsonResponse({'ok': False, 'error': 'La cantidad y el costo deben ser mayores a 0.'})
        
        material = Material.objects.get(id=material_id)
        costo_unitario = costo_total / cantidad
        
        # 1. Registrar entrada al inventario (el signal del modelo actualiza el stock y el costo promedio)
        mov_inventario = MovimientoInventario.objects.create(
            material=material,
            tipo='ENTRADA',
            cantidad=cantidad,
            costo_unitario=costo_unitario,
            costo_total=costo_total,
            motivo=f'Compra: {notas}'
        )
        
        # 2. Registrar salida de dinero de la caja
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='COMPRA_MATERIAL',
            monto=costo_total,
            concepto=f'Compra de {cantidad} {material.unidad_medida} de {material.nombre}',
            metodo='EFECTIVO' # Luego podemos hacer que se elija
        )
        
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)})


def detalle_material(request, pk):
    """Muestra el historial de movimientos de un material específico."""
    material = get_object_or_404(Material, pk=pk)
    movimientos = material.movimientos.all().order_by('-fecha')
    
    return render(request, 'inventario/detalle.html', {
        'material': material,
        'movimientos': movimientos
    })

def registrar_ajuste(request, pk):
    """Registra una merma o ajuste manual negativo."""
    material = get_object_or_404(Material, pk=pk)
    
    if request.method == 'POST':
        cantidad = Decimal(request.POST.get('cantidad', 0))
        motivo = request.POST.get('motivo', 'Merma / Daño')
        
        if cantidad > 0:
            # Creamos un movimiento de SALIDA (sin pedido asociado)
            MovimientoInventario.objects.create(
                material=material,
                tipo='SALIDA',
                cantidad=cantidad,
                costo_unitario=material.costo_promedio,
                motivo=motivo
            )
            messages.success(request, f'Se registraron {cantidad} {material.unidad_medida} de merma.')
            return redirect('inventario:detalle', pk=pk)
            
    return redirect('inventario:detalle', pk=pk)