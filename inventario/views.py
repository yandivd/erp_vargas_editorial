from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import F
from decimal import Decimal
from finanzas.models import MovimientoCaja
from pedidos.models import Pedido
from .models import LoteConsumo, Material, MovimientoInventario
from django.utils import timezone
from .models import Material, MovimientoInventario, LoteConsumo
from .services import ServicioInventario
from django.db import transaction
# ... tus otros imports ...



def lista_inventario(request):
    # Forzamos a consultar la base de datos de nuevo
    materiales = Material.objects.filter(activo=True).order_by('nombre')
    lotes = LoteConsumo.objects.filter(estado='CERRADO').select_related('material').order_by('material__nombre', 'codigo')
    
    return render(request, 'inventario/lista.html', {
        'materiales': materiales,
        'lotes': lotes
    })

def abrir_lote(request, lote_id):
    lote = get_object_or_404(LoteConsumo, id=lote_id)
    
    if lote.estado == 'CERRADO':
        with transaction.atomic():
            # 1. Cambiamos el estado del lote
            lote.estado = 'EN_USO'
            lote.fecha_apertura = timezone.now()
            lote.save()
            
            # 2. Registramos el egreso en caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='GASTO_OPERATIVO',
                monto=lote.costo_total,
                concepto=f'Apertura de {lote.codigo} ({lote.material.nombre})',
            )
            
            material = lote.material
            
            # 3. Restamos el stock de consumo
            material.stock_consumo -= lote.cantidad_inicial
            
            # 4. Restamos el stock principal
            cantidad_a_restar = Decimal(str(lote.cantidad_inicial)) / Decimal(str(material.cantidad_por_unidad))
            
            stock_anterior = material.stock_actual
            material.stock_actual = material.stock_actual - cantidad_a_restar
            
            # Imprimimos en la consola para diagnosticar
            print(f"--- ABRIENDO {lote.codigo} ---")
            print(f"Stock anterior: {stock_anterior}")
            print(f"Cantidad a restar: {cantidad_a_restar}")
            print(f"Stock nuevo: {material.stock_actual}")
            
            material.save()
            
            messages.success(request, f'Lote {lote.codigo} ejecutado. Gasto registrado: ${lote.costo_total}. Stock restante: {material.stock_actual}')
        
    return redirect('inventario:lista')

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
                motivo=f'Compra: {notas}'
            )
            
            # 2. Registrar salida de dinero de la caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='COMPRA_MATERIAL',
                monto=costo_total,
                concepto=f'Compra de {cantidad} {material.unidad_medida} de {material.nombre}',
                metodo='EFECTIVO'
            )
            
            # 3. CREAR LOS LOTES DE CONSUMO (Usando bulk_create para velocidad)
            if material.unidad_consumo:
                total_lotes = int(cantidad * material.cantidad_por_unidad)
                costo_por_lote = costo_total / total_lotes
                
                ultimo_lote = LoteConsumo.objects.filter(material=material).order_by('-id').first()
                
                if ultimo_lote and '-' in ultimo_lote.codigo:
                    try:
                        contador = int(ultimo_lote.codigo.split('-')[1]) + 1
                    except ValueError:
                        contador = 1
                else:
                    contador = 1
                
                lotes_a_crear = []
                prefijo = material.nombre[:4].upper().replace(" ", "")
                
                for i in range(total_lotes):
                    codigo = f"{prefijo}-{contador:03d}"
                    lotes_a_crear.append(
                        LoteConsumo(
                            material=material,
                            codigo=codigo,
                            cantidad_inicial=1,
                            cantidad_actual=1,
                            costo_total=costo_por_lote,
                            estado='CERRADO'
                        )
                    )
                    contador += 1
                
                # Guardamos todos los lotes en 1 sola consulta
                LoteConsumo.objects.bulk_create(lotes_a_crear)
                
                # Actualizamos el material
                material.stock_consumo += total_lotes
                material.save()
        
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
                motivo=motivo or f'Salida manual de {material.nombre}'
            )

        messages.success(request, f'Se registró la salida de {cantidad} {material.unidad_medida} de {material.nombre}.')
        return redirect('inventario:lista')

    # GET: mostrar formulario
    pedidos = Pedido.objects.exclude(estado__nombre__in=['Entregado', 'Cancelado']).order_by('-fecha_pedido')
    return render(request, 'inventario/registrar_salida.html', {
        'material': material,
        'pedidos': pedidos,
    })
