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
        
        empleado = get_object_or_404(Empleado, id=empleado_id)
        
        if monto > 0:
            with transaction.atomic():
                # 1. Registrar el pago
                PagoNomina.objects.create(
                    empleado=empleado,
                    monto_pagado=monto,
                    mes_correspondiente=mes,
                    notas=notas
                )
                # 2. Sacar el dinero de la caja
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria='PAGO_NOMINA',
                    monto=monto,
                    concepto=f'Salario {mes} - {empleado.nombre}',
                    metodo='EFECTIVO'
                )
            messages.success(request, f'Salario pagado a {empleado.nombre} por ${monto}.')
        return redirect('empleados:lista')
    return redirect('empleados:lista')