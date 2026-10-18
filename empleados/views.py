from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import transaction
from decimal import Decimal
from .models import Empleado, PagoNomina
from finanzas.models import MovimientoCaja

def lista_empleados(request):
    empleados = Empleado.objects.filter(activo=True)
    total_nomina = sum(e.salario_base for e in empleados)
    pagos = PagoNomina.objects.all().order_by('-fecha')[:20]
    
    return render(request, 'empleados/lista.html', {
        'empleados': empleados,
        'total_nomina': total_nomina,
        'pagos': pagos
    })

def registrar_empleado(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        cargo = request.POST.get('cargo')
        telefono = request.POST.get('telefono', '')
        salario = Decimal(request.POST.get('salario_base', 0))
        
        if nombre and salario > 0:
            Empleado.objects.create(
                nombre=nombre,
                cargo=cargo,
                telefono=telefono,
                salario_base=salario
            )
            messages.success(request, f'Empleado {nombre} registrado.')
        return redirect('empleados:lista')
    return redirect('empleados:lista')

def pagar_nomina(request):
    if request.method == 'POST':
        empleado_id = request.POST.get('empleado_id')
        monto = Decimal(request.POST.get('monto', 0))
        mes = request.POST.get('mes')
        notas = request.POST.get('notas', '')
        tipo_pago = request.POST.get('tipo_pago', 'SALARIO') # <-- NUEVO
        
        empleado = get_object_or_404(Empleado, id=empleado_id)
        
        if monto > 0:
            with transaction.atomic():
                PagoNomina.objects.create(
                    empleado=empleado,
                    tipo=tipo_pago,
                    monto_pagado=monto,
                    mes_correspondiente=mes,
                    notas=notas
                )
                
                # Asignamos la categoría correcta según el tipo de pago
                categoria_caja = 'PAGO_NOMINA' if tipo_pago == 'SALARIO' else 'RETIRO_UTILIDADES'
                concepto_caja = f'Salario {mes}' if tipo_pago == 'SALARIO' else f'Retiro de Utilidades {mes}'
                
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria=categoria_caja,
                    monto=monto,
                    concepto=f'{concepto_caja} - {empleado.nombre}',
                    metodo='EFECTIVO'
                )
            messages.success(request, f'Pago registrado a {empleado.nombre} por ${monto}.')
        return redirect('empleados:lista')
    return redirect('empleados:lista')

from finanzas.services import ServicioFinanzas # <-- Importar

def lista_empleados(request):
    empleados = Empleado.objects.filter(activo=True)
    total_nomina = sum(e.salario_base for e in empleados)
    pagos = PagoNomina.objects.all().order_by('-fecha')[:20]
    
    # Calculamos la utilidad sugerida (Fondo de reserva: $50,000, Retiro seguro: 50%)
    utilidad = ServicioFinanzas.calcular_utilidad_disponible(fondo_reserva=50000, porcentaje_seguridad=0.5)
    
    return render(request, 'empleados/lista.html', {
        'empleados': empleados,
        'total_nomina': total_nomina,
        'pagos': pagos,
        'utilidad': utilidad
    })