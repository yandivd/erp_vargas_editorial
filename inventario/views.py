from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import F
from decimal import Decimal
from finanzas.models import MovimientoCaja
from pedidos.models import Pedido
from .models import Material, MovimientoInventario
from .services import ServicioInventario
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
import os
from django.conf import settings
# ... tus otros imports ...



def lista_inventario(request):
    # Forzamos a consultar la base de datos de nuevo
    materiales = Material.objects.filter(activo=True).order_by('nombre')
    
    return render(request, 'inventario/lista.html', {
        'materiales': materiales,
    })

def registrar_compra_modal(request):
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
        
        # Usamos transaction.atomic para que si algo falla, no se guarde a medias
        with transaction.atomic():
            # 1. Registrar entrada al inventario
            MovimientoInventario.objects.create(
                material=material,
                tipo='ENTRADA',
                cantidad=cantidad,
                costo_unitario=costo_unitario,
                costo_total=costo_total,
                motivo=f'Compra: {notas}',
                usuario=request.user if request.user.is_authenticated else None,
            )
            
            # 2. Registrar salida de dinero de la caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='COMPRA_MATERIAL',
                monto=costo_total,
                concepto=f'Compra de {cantidad} {material.unidad_medida} de {material.nombre}',
                metodo='EFECTIVO'
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
                motivo=motivo,
                usuario=request.user if request.user.is_authenticated else None,
            )
            messages.success(request, f'Se registraron {cantidad} {material.unidad_medida} de merma.')
            return redirect('inventario:detalle', pk=pk)
            
    return redirect('inventario:detalle', pk=pk)

def registrar_salida_material(request, pk):
    """Registra una salida manual de material del inventario."""
    material = get_object_or_404(Material, pk=pk)

    if request.method == 'POST':
        cantidad = Decimal(request.POST.get('cantidad', 0))
        motivo = request.POST.get('motivo', '')
        pedido_id = request.POST.get('pedido_id')

        if cantidad <= 0:
            messages.error(request, 'La cantidad debe ser mayor a 0.')
            return redirect('inventario:lista')  # Ajusta al nombre de tu URL

        if cantidad > material.stock_actual:
            messages.error(request, f'No hay suficiente stock. Disponible: {material.stock_actual}')
            return redirect('inventario:lista')

        with transaction.atomic():
            pedido = None
            if pedido_id:
                pedido = Pedido.objects.filter(id=pedido_id).first()

            # Registrar el movimiento
            ServicioInventario.registrar_consumo(
                material, cantidad, pedido,
                motivo=motivo or f'Salida manual de {material.nombre}',
                usuario=request.user if request.user.is_authenticated else None,
            )

        messages.success(request, f'Se registró la salida de {cantidad} {material.unidad_medida} de {material.nombre}.')
        return redirect('inventario:lista')

    # GET: mostrar formulario
    pedidos = Pedido.objects.exclude(estado__nombre__in=['Entregado', 'Cancelado']).order_by('-fecha_pedido')
    return render(request, 'inventario/registrar_salida.html', {
        'material': material,
        'pedidos': pedidos,
    })

def imprimir_movimiento(request, pk):
    movimiento = get_object_or_404(MovimientoInventario, pk=pk)
    
    # Rutas absolutas para WeasyPrint (logo)
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'logo1.jpg')
    
    html_string = render_to_string('inventario/imprimir_movimiento.html', {
        'movimiento': movimiento,
        'logo_path': f'file:///{logo_path.replace(os.sep, "/")}',
    }, request=request)
    
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf()
    
    response = HttpResponse(pdf, content_type='application/pdf')
    tipo = 'salida' if movimiento.tipo == 'SALIDA' else 'entrada'
    response['Content-Disposition'] = f'inline; filename="orden-{tipo}-{movimiento.id}.pdf"'
    return response
