from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q

from .models import Pedido, ServicioExterno
from .services import ServicioPedido, CosteadorPedido
from clientes.models import Cliente
from finanzas.services import ServicioFinanzas


def lista(request):
    pedidos = Pedido.objects.select_related('cliente').all()
    
    # Filtros
    estado = request.GET.get('estado', '')
    busqueda = request.GET.get('q', '')
    solo_atrasados = request.GET.get('atrasados', '')
    
    if estado:
        pedidos = pedidos.filter(estado=estado)
    if busqueda:
        pedidos = pedidos.filter(
            Q(titulo_libro__icontains=busqueda) |
            Q(autor__icontains=busqueda) |
            Q(cliente__nombre__icontains=busqueda)
        )
    
    # Ordenar
    pedidos = list(pedidos.order_by('-fecha_pedido'))
    if solo_atrasados:
        pedidos = [p for p in pedidos if p.esta_atrasado]
    
    context = {
        'pedidos': pedidos,
        'estados': Pedido.ESTADO_CHOICES,
        'estado_actual': estado,
        'busqueda': busqueda,
    }
    return render(request, 'pedidos/lista.html', context)


def detalle(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    costo = CosteadorPedido(pedido).calcular()
    
    context = {
        'pedido': pedido,
        'costo': costo,
        'estados': Pedido.ESTADO_CHOICES,
    }
    return render(request, 'pedidos/detalle.html', context)


def cambiar_estado(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado')
        notas = request.POST.get('notas', '')
        ServicioPedido.cambiar_estado(
            pedido, nuevo_estado,
            usuario=request.user.username,
            notas=notas
        )
        messages.success(request, f'Estado cambiado a {nuevo_estado}')
    return redirect('pedidos:detalle', pk=pk)


def registrar_anticipo(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        monto = request.POST.get('monto')
        metodo = request.POST.get('metodo', 'EFECTIVO')
        ServicioFinanzas.registrar_anticipo(pedido, monto=float(monto), metodo=metodo)
        messages.success(request, f'Anticipo registrado: ${monto}')
    return redirect('pedidos:detalle', pk=pk)

def confirmar_pedido(request, pk):
    """Cambia el pedido de Borrador a Pendiente de anticipo."""
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        if pedido.estado == 'Borrador':
            ServicioPedido.cambiar_estado(
                pedido, 'Pendiente de anticipo',
                usuario=request.user.username,
                notas='Cliente confirmó'
            )
            messages.success(request, 'Pedido confirmado. Esperando anticipo.')
    return redirect('pedidos:detalle', pk=pk)