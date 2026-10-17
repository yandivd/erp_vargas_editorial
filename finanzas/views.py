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