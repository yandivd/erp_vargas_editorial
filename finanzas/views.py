from django.db import transaction
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

from .models import MovimientoCaja, GastoOperativo


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
    
    context = {
        'movimientos': movimientos,
        'total_ingresos': total_ingresos,
        'total_egresos': total_egresos,
        'saldo_actual': saldo_actual,
        'categorias': MovimientoCaja.CATEGORIA_CHOICES,
        'desde': desde,
        'hasta': hasta,
        'categoria_actual': categoria,
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