from pyexpat.errors import messages
from django.shortcuts import redirect, render, get_object_or_404
from django.core.paginator import Paginator
from django.db.models import Count
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.template.loader import render_to_string
from .models import Cliente

def lista_clientes(request):
    # 1. Ordenamiento
    orden = request.GET.get('orden', 'nombre_asc')
    
    if orden == 'nombre_desc':
        clientes_list = Cliente.objects.all().order_by('-nombre')
    elif orden == 'pedidos_asc':
        clientes_list = Cliente.objects.annotate(num_pedidos=Count('pedidos')).order_by('num_pedidos')
    elif orden == 'pedidos_desc':
        clientes_list = Cliente.objects.annotate(num_pedidos=Count('pedidos')).order_by('-num_pedidos')
    else:
        # Por defecto: nombre ascendente
        clientes_list = Cliente.objects.all().order_by('nombre')

    # 2. Filtros (igual que antes)
    nombre = request.GET.get('nombre', '').strip()
    telefono = request.GET.get('telefono', '').strip()
    email = request.GET.get('email', '').strip()
    deuda = request.GET.get('deuda', '')

    if nombre:
        clientes_list = clientes_list.filter(nombre__icontains=nombre)
    if telefono:
        clientes_list = clientes_list.filter(telefono__icontains=telefono)
    if email:
        clientes_list = clientes_list.filter(email__icontains=email)
    if deuda:
        if deuda == 'con_deuda':
            clientes_list = [c for c in clientes_list if c.saldo_pendiente_total > 0]
        elif deuda == 'al_dia':
            clientes_list = [c for c in clientes_list if c.saldo_pendiente_total == 0]

    # 3. Paginación
    paginator = Paginator(clientes_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    # 4. Respuesta AJAX
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        html = render_to_string('clientes/_tabla_clientes.html', {
            'clientes': page_obj,
            'total_clientes': paginator.count,
            'orden_actual': orden,
        }, request=request)
        return JsonResponse({'html': html})

    return render(request, 'clientes/lista.html', {
        'clientes': page_obj,
        'total_clientes': paginator.count,
        'f_nombre': nombre,
        'f_telefono': telefono,
        'f_email': email,
        'f_deuda': deuda,
        'orden_actual': orden,
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