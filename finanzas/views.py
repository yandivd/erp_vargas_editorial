from django.db import transaction
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from .models import MovimientoCaja, GastoOperativo, CierreCaja
from .services import ServicioFinanzas


def caja(request):
    """Muestra el flujo de caja y los movimientos."""
    movimientos = MovimientoCaja.objects.all().order_by('-fecha')
    
    # Filtros
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    categoria = request.GET.get('categoria', '')
    
    if desde:
        movimientos = movimientos.filter(fecha__date__gte=desde)
    if hasta:
        movimientos = movimientos.filter(fecha__date__lte=hasta)
    if categoria:
        movimientos = movimientos.filter(categoria=categoria)
        
    # Totales (calculados sobre TODOS los movimientos, no solo los filtrados, para el resumen general)
    total_ingresos = MovimientoCaja.objects.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
    total_egresos = MovimientoCaja.objects.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
    saldo_actual = total_ingresos - total_egresos
    
    # Calcular valor del inventario
    materiales = Material.objects.filter(activo=True)
    valor_inventario = sum(m.stock_actual * m.costo_promedio for m in materiales)
    
    context = {
        'movimientos': movimientos,
        'total_ingresos': total_ingresos,
        'total_egresos': total_egresos,
        'saldo_actual': saldo_actual,
        'categorias': MovimientoCaja.CATEGORIA_CHOICES,
        'desde': desde,
        'hasta': hasta,
        'categoria_actual': categoria,
        'valor_inventario': valor_inventario,
    }
    return render(request, 'finanzas/caja.html', context)


def registrar_gasto(request):
    """Registra un gasto operativo (luz, internet, alquiler)."""
    if request.method == 'POST':
        concepto = request.POST.get('concepto')
        monto = Decimal(request.POST.get('monto', 0))
        
        if monto > 0 and concepto:
            # 1. Guardamos el gasto operativo (para reportes mensuales)
            GastoOperativo.objects.create(
                concepto=concepto,
                monto=monto,
                fecha=timezone.now().date(),
                mes_imputacion=timezone.now().date().replace(day=1)
            )
            
            # 2. Registramos la salida de dinero en la caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='GASTO_OPERATIVO',
                monto=monto,
                concepto=concepto,
                metodo='EFECTIVO'
            )
            messages.success(request, f'Gasto registrado: {concepto} por ${monto}')
            
    return redirect('finanzas:caja')

from django.shortcuts import render, redirect
from django.contrib import messages
from django.utils import timezone
from .models import ActivoFijo
from .services_depreciacion import ServicioDepreciacion

def lista_activos(request):
    activos = ActivoFijo.objects.filter(activo=True).order_by('-fecha_compra')
    
    # Calculamos el total del valor en libros
    valor_total = sum(a.valor_actual for a in activos)
    
    return render(request, 'finanzas/activos.html', {
        'activos': activos,
        'valor_total': valor_total
    })

def registrar_activo(request):
    """Registra un activo nuevo y lo saca de caja."""
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        fecha_compra = request.POST.get('fecha_compra')
        valor_compra = Decimal(request.POST.get('valor_compra', 0))
        vida_util = int(request.POST.get('vida_util', 60))
        
        if valor_compra > 0 and nombre:
            with transaction.atomic():
                # 1. Creamos el activo
                activo = ActivoFijo.objects.create(
                    nombre=nombre,
                    fecha_compra=fecha_compra,
                    valor_compra=valor_compra,
                    vida_util_meses=vida_util,
                    valor_residual=0
                )
                
                # 2. Registramos la salida de dinero de la caja
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria='COMPRA_ACTIVO',
                    monto=valor_compra,
                    concepto=f'Compra de activo fijo: {nombre}',
                    metodo='EFECTIVO'
                )
                messages.success(request, f'Activo "{nombre}" registrado y descontado de caja.')
        else:
            messages.error(request, 'El nombre y el valor deben ser válidos.')
            
    return redirect('finanzas:activos')

def depreciar_mes(request):
    """Ejecuta la depreciación del mes actual."""
    hoy = timezone.now().date()
    try:
        resultados = ServicioDepreciacion.depreciar_mes(hoy.year, hoy.month)
        if resultados:
            messages.success(request, f'Se registró la depreciación de {len(resultados)} activos para {hoy.strftime("%B %Y")}.')
        else:
            messages.info(request, 'No hay activos pendientes de depreciar este mes.')
    except Exception as e:
        messages.error(request, f'Error al depreciar: {str(e)}')
        
    return redirect('finanzas:activos')

from django.shortcuts import render
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from .models import MovimientoCaja, ActivoFijo, Depreciacion, GastoOperativo
from pedidos.models import Pedido, Estado, ServicioExterno
from inventario.models import Material, MovimientoInventario

def reporte_mensual(request):
    # Por defecto, mostramos el mes actual
    hoy = timezone.now().date()
    
    # Obtenemos las fechas del formulario o usamos el mes actual
    desde_str = request.GET.get('desde', hoy.replace(day=1).strftime('%Y-%m-%d'))
    hasta_str = request.GET.get('hasta', hoy.strftime('%Y-%m-%d'))
    
    # Convertimos a fechas reales
    desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
    hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()

    # ==========================================
    # 1. INGRESOS Y EGRESOS (FLUJO DE CAJA)
    # ==========================================
    movimientos = MovimientoCaja.objects.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
    
    ingresos_totales = movimientos.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
    egresos_totales = movimientos.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
    saldo_periodo = ingresos_totales - egresos_totales

    # ==========================================
    # 2. VENTAS REALES (PEDIDOS ENTREGADOS)
    # ==========================================
    pedidos_entregados = Pedido.objects.filter(
        estado__nombre='Entregado',
        fecha_entrega_real__date__gte=desde,
        fecha_entrega_real__date__lte=hasta
    )
    # En lugar de sumar el precio teórico, sumamos el dinero que realmente entró a Caja
    # por concepto de Anticipos y Saldos de esos pedidos en ese rango de fechas.
    
    total_ventas = MovimientoCaja.objects.filter(
        tipo='INGRESO',
        categoria__in=['ANTICIPO_CLIENTE', 'SALDO_CLIENTE'],
        fecha__date__gte=desde,
        fecha__date__lte=hasta
    ).aggregate(t=Sum('monto'))['t'] or 0
    cantidad_libros = pedidos_entregados.count()

    # ==========================================
    # 3. COSTOS DE PRODUCCIÓN (MATERIALES)
    # ==========================================
    # Sumamos el costo de los materiales usados en esos pedidos entregados
    costo_materiales = MovimientoInventario.objects.filter(
        pedido__in=pedidos_entregados, 
        tipo='SALIDA'
    ).aggregate(t=Sum('costo_total'))['t'] or 0

    # ==========================================
    # 4. SERVICIOS EXTERNOS (PROVEEDORES)
    # ==========================================
    costo_servicios = ServicioExterno.objects.filter(
        pedido__in=pedidos_entregados
    ).aggregate(t=Sum('monto'))['t'] or 0

    # ==========================================
    # 5. GASTOS OPERATIVOS Y DEPRECIACIÓN
    # ==========================================
    gastos_operativos = MovimientoCaja.objects.filter(
        categoria__in=['GASTO_OPERATIVO', 'PAGO_NOMINA', 'COMPRA_MATERIAL'],
        fecha__date__gte=desde, 
        fecha__date__lte=hasta
    ).aggregate(t=Sum('monto'))['t'] or 0

    # Calculamos cuánto se retiró como utilidades (no afecta la ganancia)
    retiros_utilidades = MovimientoCaja.objects.filter(
        categoria='RETIRO_UTILIDADES',
        fecha__date__gte=desde, 
        fecha__date__lte=hasta
    ).aggregate(t=Sum('monto'))['t'] or 0

    depreciacion = Depreciacion.objects.filter(
        mes__gte=desde, mes__lte=hasta
    ).aggregate(t=Sum('monto'))['t'] or 0

    # ==========================================
    # 6. CÁLCULO DE GANANCIA NETA
    # ==========================================
    # (Ventas Reales) - (Materiales + Proveedores + Gastos + Depreciación)
    ganancia_bruta = total_ventas - costo_materiales - costo_servicios
    ganancia_neta = ganancia_bruta - gastos_operativos - depreciacion
    flujo_caja_neto = ingresos_totales - egresos_totales
    
    margen_neto = (ganancia_neta / total_ventas * 100) if total_ventas > 0 else 0

    context = {
        'desde': desde_str,
        'hasta': hasta_str,
        'ingresos_totales': ingresos_totales,
        'egresos_totales': egresos_totales,
        'saldo_periodo': saldo_periodo,
        'total_ventas': total_ventas,
        'cantidad_libros': cantidad_libros,
        'costo_materiales': costo_materiales,
        'costo_servicios': costo_servicios,
        'gastos_operativos': gastos_operativos,
        'depreciacion': depreciacion,
        'ganancia_bruta': ganancia_bruta,
        'ganancia_neta': ganancia_neta,
        'margen_neto': margen_neto,
        'pedidos': pedidos_entregados,
    }
    return render(request, 'finanzas/reportes.html', context)

def arqueo_caja(request):
    saldo_sistema = ServicioFinanzas.saldo_caja()
    
    if request.method == 'POST':
        # Capturar Transferencia
        transferencia = Decimal(request.POST.get('transferencia', 0) or 0)
        
        # Capturar Billetes
        denominaciones = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1]
        cantidades = {}
        total_efectivo = transferencia
        
        for d in denominaciones:
            cant = int(request.POST.get(f'bill_{d}', 0) or 0)
            cantidades[f'b_{d}'] = cant
            total_efectivo += (cant * d)
            
        notas = request.POST.get('notas', '')
        diferencia = total_efectivo - saldo_sistema
        
        # Crear el registro
        cierre = CierreCaja.objects.create(
            usuario=request.user.username,
            saldo_sistema=saldo_sistema,
            efectivo_real=total_efectivo,
            diferencia=diferencia,
            transferencia=transferencia,
            notas=notas,
            **cantidades
        )
        
        # Si hay diferencia, la registramos en caja
        if diferencia != 0:
            tipo_mov = 'INGRESO' if diferencia > 0 else 'EGRESO'
            MovimientoCaja.objects.create(
                tipo=tipo_mov,
                categoria='OTRO',
                monto=abs(diferencia),
                concepto=f"Ajuste por arqueo de caja ({'Sobrante' if diferencia > 0 else 'Faltante'})",
                metodo='EFECTIVO'
            )
            messages.warning(request, f'Se registró un ajuste por diferencia de ${abs(diferencia)}')
        else:
            messages.success(request, '¡La caja cuadró perfectamente!')
            
        return redirect('finanzas:arqueo_caja')

    cierres = CierreCaja.objects.all().order_by('-fecha')[:10]
    
    return render(request, 'finanzas/arqueo_caja.html', {
        'saldo_sistema': saldo_sistema,
        'cierres': cierres,
        'denominaciones': [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1]
    })