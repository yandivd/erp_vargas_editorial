from django.contrib import messages
from django.shortcuts import redirect, render, get_object_or_404
from django.db.models import Q, Sum
from .models import Cliente


def lista_clientes(request):
    """Muestra el directorio de clientes con un buscador."""
    clientes = Cliente.objects.all().order_by('nombre')
    
    busqueda = request.GET.get('q', '')
    if busqueda:
        clientes = clientes.filter(
            Q(nombre__icontains=busqueda) | 
            Q(telefono__icontains=busqueda) |
            Q(email__icontains=busqueda)
        )
        
    return render(request, 'clientes/lista.html', {
        'clientes': clientes,
        'busqueda': busqueda
    })


def detalle_cliente(request, pk):
    """Muestra el perfil, estadísticas e historial de pedidos de un cliente."""
    cliente = get_object_or_404(Cliente, pk=pk)
    
    # Historial de pedidos
    pedidos = cliente.pedidos.all().select_related('libro', 'estado').order_by('-fecha_pedido')
    
    # Estadísticas financieras
    total_pedidos = pedidos.count()
    total_facturado = pedidos.aggregate(total=Sum('precio_venta'))['total'] or 0
    total_pagado = pedidos.aggregate(total=Sum('anticipo_recibido'))['total'] or 0
    total_deuda = pedidos.aggregate(total=Sum('saldo_pendiente'))['total'] or 0
    
    return render(request, 'clientes/detalle.html', {
        'cliente': cliente,
        'pedidos': pedidos,
        'total_pedidos': total_pedidos,
        'total_facturado': total_facturado,
        'total_pagado': total_pagado,
        'total_deuda': total_deuda,
    })

def crear_cliente(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        telefono = request.POST.get('telefono', '')
        direccion = request.POST.get('direccion', '')
        
        if nombre:
            Cliente.objects.create(
                nombre=nombre,
                telefono=telefono,
                direccion=direccion
            )
            messages.success(request, f'Cliente "{nombre}" registrado.')
        else:
            messages.error(request, 'El nombre es obligatorio.')
            
    return redirect('clientes:lista')