from django.db import transaction
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse
from django.core.paginator import Paginator
from django import forms
from decimal import Decimal

from django.http import JsonResponse
from django.template.loader import render_to_string

from .models import Pedido, ServicioExterno, Book, Estado
from .services import ServicioPedido, CosteadorPedido
from clientes.models import Cliente
from finanzas.services import ServicioFinanzas

class ClienteSelectConTelefono(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value:
            try:
                cliente = Cliente.objects.get(pk=value.value)
                if cliente.telefono:
                    # Inyectamos el teléfono en el atributo data-telefono
                    option['attrs']['data-telefono'] = cliente.telefono
            except Cliente.DoesNotExist:
                pass
        return option
    
class LibroSelectConPaginas(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value:
            try:
                libro = Book.objects.get(pk=value.value)
                option['attrs']['data-paginas'] = libro.paginas
                option['attrs']['data-precio'] = libro.precio
                option['attrs']['data-anticipo'] = round(libro.precio / 2, 2)
                option['attrs']['data-autor'] = libro.autor or "Autor desconocido" # <-- NUEVO
            except Book.DoesNotExist:
                pass
        return option

class LibroSelectConPaginas(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value:
            try:
                libro = Book.objects.get(pk=value.value)
                option['attrs']['data-paginas'] = libro.paginas
                option['attrs']['data-precio'] = libro.precio
                option['attrs']['data-anticipo'] = round(libro.precio / 2, 2) # La mitad del precio
            except Book.DoesNotExist:
                pass
        return option
    
# Formulario rápido para el modal (ahora usa Book)
class NuevoPedidoForm(forms.Form):
    cliente = forms.ModelChoiceField(
        queryset=Cliente.objects.all(), 
        required=False, 
        widget=ClienteSelectConTelefono(attrs={'class': 'form-select'}) # <-- Usamos el nuevo widget
    )
    nuevo_cliente_nombre = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre nuevo'}))
    nuevo_cliente_telefono = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Teléfono'}))
    nuevo_cliente_direccion = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Dirección (opcional)'})) # <-- NUEVO
    
    libro = forms.ModelChoiceField(
        queryset=Book.objects.all(), 
        required=False, 
        widget=LibroSelectConPaginas(attrs={'class': 'form-select'}) # <-- Usamos el widget
    )
    nuevo_libro_titulo = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Título nuevo'}))
    nuevo_libro_autor = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Autor'}))
    nuevo_libro_paginas = forms.IntegerField(required=False, widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Páginas'}))
    # nuevo_libro_precio = forms.DecimalField(required=False, widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Precio Base', 'step': '0.01'})) # <-- NUEVO

    cantidad = forms.IntegerField(initial=1, widget=forms.NumberInput(attrs={'class': 'form-control', 'min': 1}))
    lleva_scotch = forms.BooleanField(required=False)
    lleva_esquineros = forms.BooleanField(required=False)
    
    precio_venta = forms.DecimalField(widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}))
    anticipo_requerido = forms.DecimalField(required=False, widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}))
    fecha_entrega_prometida = forms.DateField(required=False, widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}))
    
    direccion_entrega = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 2}))
    telefono_entrega = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control'}))
    notas = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 2}))

    def clean(self):
        cleaned_data = super().clean()
        if not cleaned_data.get('cliente') and not cleaned_data.get('nuevo_cliente_nombre'):
            raise forms.ValidationError('Debes seleccionar un cliente o crear uno nuevo.')
        if not cleaned_data.get('libro') and not cleaned_data.get('nuevo_libro_titulo'):
            raise forms.ValidationError('Debes seleccionar un libro o crear uno nuevo.')
        if not cleaned_data.get('libro') and not cleaned_data.get('nuevo_libro_paginas'):
            raise forms.ValidationError('Si creas un libro nuevo, debes indicar las páginas.')
        return cleaned_data


# 1. Función que calcula los pedidos filtrados (para no repetir código)
def _obtener_pedidos_filtrados(request, solo_entregados=False):
    if solo_entregados:
        pedidos_list = Pedido.objects.select_related('cliente', 'libro', 'estado').filter(estado__nombre='Entregado').order_by('-fecha_entrega_real', '-fecha_pedido')
    else:
        pedidos_list = Pedido.objects.select_related('cliente', 'libro', 'estado').exclude(estado__nombre__in=['Entregado', 'Cancelado']).order_by('-fecha_pedido')
    
    busqueda = request.GET.get('q', '').strip()
    estado_id = request.GET.get('estado', '')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    pago_status = request.GET.get('pago', '')

    if busqueda:
        pedidos_list = pedidos_list.filter(
            Q(libro__titulo__icontains=busqueda) |
            Q(libro__autor__icontains=busqueda) |
            Q(cliente__nombre__icontains=busqueda) |
            Q(referencia_externa__icontains=busqueda)
        )
    
    if estado_id and not solo_entregados:
        pedidos_list = pedidos_list.filter(estado_id=estado_id)
        
    if desde:
        if solo_entregados:
            pedidos_list = pedidos_list.filter(fecha_entrega_real__date__gte=desde)
        else:
            pedidos_list = pedidos_list.filter(fecha_pedido__date__gte=desde)
            
    if hasta:
        if solo_entregados:
            pedidos_list = pedidos_list.filter(fecha_entrega_real__date__lte=hasta)
        else:
            pedidos_list = pedidos_list.filter(fecha_pedido__date__lte=hasta)
            
    if pago_status and not solo_entregados:
        if pago_status == 'pagado':
            pedidos_list = pedidos_list.filter(saldo_pendiente=0)
        elif pago_status == 'pendiente':
            pedidos_list = pedidos_list.filter(saldo_pendiente__gt=0)
        elif pago_status == 'atrasado':
            pedidos_list = [p for p in pedidos_list if p.esta_atrasado]

    return pedidos_list

# 2. Vista principal (Carga inicial)
def lista(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=False).order_by('referencia_externa')
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'pedidos/lista.html', {
        'pedidos': page_obj,
        'estados': Estado.objects.exclude(nombre__in=['Entregado', 'Cancelado']).order_by('orden'),
        'estado_actual': request.GET.get('estado', ''),
        'busqueda': request.GET.get('q', ''),
        'desde': request.GET.get('desde', ''),
        'hasta': request.GET.get('hasta', ''),
        'pago_actual': request.GET.get('pago', ''),
        'form': NuevoPedidoForm(),
        'total_pedidos': paginator.count,
    })

# 3. Vista AJAX (Devuelve solo el HTML de la tabla)
def lista_ajax(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=False).order_by('referencia_externa')
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_pedidos.html', {
        'pedidos': page_obj,
        'total_pedidos': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


# 1. Vista normal para cargar la página por primera vez
def lista_entregados(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=True)
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'pedidos/lista_entregados.html', {
        'pedidos': page_obj,
        'busqueda': request.GET.get('q', ''),
        'desde': request.GET.get('desde', ''),
        'hasta': request.GET.get('hasta', ''),
        'total_pedidos': paginator.count,
    })

# 2. Vista AJAX que devuelve solo el HTML de la tabla de entregados
def lista_entregados_ajax(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=True)
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_entregados.html', {
        'pedidos': page_obj,
        'total_pedidos': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


def detalle(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    costo = CosteadorPedido(pedido).calcular()
    
    context = {
        'pedido': pedido,
        'costo': costo,
        'estados': Estado.objects.all().order_by('orden'),
    }
    return render(request, 'pedidos/detalle.html', context)


def cambiar_estado(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado')
        notas = request.POST.get('notas', '')
        if nuevo_estado:
            ServicioPedido.cambiar_estado(pedido, nuevo_estado, usuario=request.user.username, notas=notas)
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


def nuevo_pedido_modal(request):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Método no permitido'}, status=405)
    
    form = NuevoPedidoForm(request.POST)
    if form.is_valid():
        # Resolver Cliente
        cliente = form.cleaned_data.get('cliente')
        if not cliente:
            cliente = Cliente.objects.create(
                nombre=form.cleaned_data['nuevo_cliente_nombre'],
                telefono=form.cleaned_data.get('nuevo_cliente_telefono', ''),
                direccion=form.cleaned_data.get('nuevo_cliente_direccion', '')
            )
        
        # Resolver Libro
        libro = form.cleaned_data.get('libro')
        if not libro:
            libro = Book.objects.create(
                titulo=form.cleaned_data['nuevo_libro_titulo'],
                autor=form.cleaned_data.get('nuevo_libro_autor', ''),
                paginas=form.cleaned_data['nuevo_libro_paginas'],
                precio=form.cleaned_data.get('precio_venta', 0) # <-- Guardamos el precio calculado como precio base
            )
        
        # Crear Pedido
        estado_borrador = Estado.objects.get(nombre='Borrador')
        pedido = Pedido.objects.create(
            cliente=cliente,
            libro=libro,
            cantidad=form.cleaned_data['cantidad'],
            lleva_scotch=form.cleaned_data.get('lleva_scotch', False),
            lleva_esquineros=form.cleaned_data.get('lleva_esquineros', False),
            precio_venta=form.cleaned_data['precio_venta'],
            anticipo_requerido=form.cleaned_data.get('anticipo_requerido') or 0,
            estado=estado_borrador,
            fecha_entrega_prometida=form.cleaned_data.get('fecha_entrega_prometida'),
            direccion_entrega=form.cleaned_data.get('direccion_entrega', ''),
            telefono_entrega=form.cleaned_data.get('telefono_entrega', ''),
            notas=form.cleaned_data.get('notas', ''),
        )
        
        return JsonResponse({'ok': True, 'redirect': f'/pedidos/{pedido.id}/'})
    
    return JsonResponse({'ok': False, 'errors': form.errors})


def calcular_costo_ajax(request):
    try:
        paginas = int(request.GET.get('paginas', 0))
        lleva_scotch = request.GET.get('lleva_scotch') == 'true'
        lleva_esquineros = request.GET.get('lleva_esquineros') == 'true'
        
        if paginas <= 0:
            return JsonResponse({'ok': False, 'error': 'Páginas inválidas'})
        
        libro_temp = Book(paginas=paginas)
        pedido_temp = Pedido(
            libro=libro_temp, 
            lleva_scotch=lleva_scotch, 
            lleva_esquineros=lleva_esquineros, 
            cantidad=1, 
            precio_venta=0
        )
        
        costeador = CosteadorPedido(pedido_temp)
        resultado = costeador.calcular()
        precio_sugerido = costeador.calcular_precio_sugerido()
        anticipo_sugerido = round(precio_sugerido / 2, 2)
        
        resultado['precio_sugerido'] = float(precio_sugerido)
        resultado['anticipo_sugerido'] = float(anticipo_sugerido)
        
        return JsonResponse({'ok': True, 'costo': resultado})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)})

def confirmar_pedido(request, pk):
    """Cambia el pedido de Borrador a Pendiente a Anticipo."""
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        if pedido.estado.nombre == 'Borrador':
            ServicioPedido.cambiar_estado(
                pedido, 'Pendiente a Anticipo',
                usuario=request.user.username,
                notas='Cliente confirmó'
            )
            messages.success(request, 'Pedido confirmado. Esperando anticipo.')
    return redirect('pedidos:detalle', pk=pk)

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q, Count

# ... (tus otras funciones) ...

from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.http import JsonResponse
from django.template.loader import render_to_string

def lista_libros(request):
    # 1. Traemos todos los libros y contamos cuántos pedidos tienen
    libros_list = Book.objects.annotate(num_pedidos=Count('pedidos')).order_by('titulo')
    
    # 2. Filtro de búsqueda
    busqueda = request.GET.get('q', '').strip()
    if busqueda:
        libros_list = libros_list.filter(
            Q(titulo__icontains=busqueda) | 
            Q(autor__icontains=busqueda)
        )
        
    # 3. Paginación (10 en 10)
    paginator = Paginator(libros_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'pedidos/libros_lista.html', {
        'libros': page_obj,
        'busqueda': busqueda,
        'total_libros': paginator.count,
    })

# 4. Vista AJAX para actualizar solo la tabla
def lista_libros_ajax(request):
    libros_list = Book.objects.annotate(num_pedidos=Count('pedidos')).order_by('titulo')
    
    busqueda = request.GET.get('q', '').strip()
    if busqueda:
        libros_list = libros_list.filter(
            Q(titulo__icontains=busqueda) | 
            Q(autor__icontains=busqueda)
        )
        
    paginator = Paginator(libros_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_libros.html', {
        'libros': page_obj,
        'total_libros': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


def editar_libro(request, pk):
    """Permite editar los datos de un libro del catálogo."""
    libro = get_object_or_404(Book, pk=pk)
    
    if request.method == 'POST':
        titulo = request.POST.get('titulo')
        autor = request.POST.get('autor', '')
        paginas = request.POST.get('paginas')
        precio = request.POST.get('precio')
        
        if titulo and paginas and precio:
            libro.titulo = titulo
            libro.autor = autor
            libro.paginas = int(paginas)
            libro.precio = Decimal(precio)
            libro.save()
            messages.success(request, f'Libro "{libro.titulo}" actualizado correctamente.')
            return redirect('pedidos:lista_libros')
        else:
            messages.error(request, 'Todos los campos obligatorios deben estar llenos.')
            
    return render(request, 'pedidos/libro_editar.html', {'libro': libro})

def imprimir_pedido(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_pedido.html', {'pedido': pedido})

def imprimir_orden_servicio(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_orden_servicio.html', {'pedido': pedido})

def fabricar_para_stock(request, libro_id):
    """Crea un pedido sin cliente para fabricar un libro que se venderá en el mostrador."""
    libro = get_object_or_404(Book, pk=libro_id)
    
    if request.method == 'POST':
        cantidad = int(request.POST.get('cantidad', 1))
        
        # Creamos el pedido sin cliente, en estado Borrador
        estado_borrador = Estado.objects.get(nombre='Borrador')
        
        for _ in range(cantidad):
            Pedido.objects.create(
                cliente=None, # Sin cliente
                libro=libro,
                cantidad=1,
                precio_venta=libro.precio,
                anticipo_requerido=0, # Tú lo financias
                estado=estado_borrador,
                notas='Pedido creado para stock (Venta Directa)'
            )
            
        messages.success(request, f'Se crearon {cantidad} pedidos de "{libro.titulo}" para stock. Pásalos a producción.')
        return redirect('pedidos:lista')
        
    return render(request, 'pedidos/fabricar_stock.html', {'libro': libro})

def asignar_cliente_y_cobrar(request, pk):
    """Asigna un cliente a un pedido de stock, cobra el total y lo entrega."""
    pedido = get_object_or_404(Pedido, pk=pk)
    
    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        metodo = request.POST.get('metodo_pago', 'EFECTIVO')
        
        if not cliente_id:
            messages.error(request, 'Debes seleccionar un cliente.')
            return redirect('pedidos:detalle', pk=pedido.id)
            
        cliente = get_object_or_404(Cliente, id=cliente_id)
        
        with transaction.atomic():
            # 1. Asignar el cliente
            pedido.cliente = cliente
            pedido.save()
            
            # 2. Cobrar el total pendiente (registra en caja)
            if pedido.saldo_pendiente > 0:
                ServicioFinanzas.registrar_saldo(pedido, monto=pedido.saldo_pendiente, metodo=metodo)
            
            # 3. Avanzar el estado a Entregado
            ServicioPedido.cambiar_estado(pedido, 'Entregado', usuario=request.user.username, notas='Venta directa de stock')
            
        messages.success(request, f'Pedido #{pedido.id} vendido a {cliente.nombre} por ${pedido.precio_venta}.')
        return redirect('pedidos:detalle', pk=pedido.id)
        
    clientes = Cliente.objects.all().order_by('nombre')
    return render(request, 'pedidos/asignar_cliente.html', {
        'pedido': pedido,
        'clientes': clientes
    })

def crear_libro(request):
    if request.method == 'POST':
        titulo = request.POST.get('titulo')
        autor = request.POST.get('autor', '')
        paginas = request.POST.get('paginas')
        precio = request.POST.get('precio', 0)
        
        if titulo and paginas:
            Book.objects.create(
                titulo=titulo,
                autor=autor,
                paginas=int(paginas),
                precio=Decimal(precio) if precio else Decimal('0')
            )
            messages.success(request, f'Libro "{titulo}" agregado al catálogo.')
        else:
            messages.error(request, 'El título y las páginas son obligatorios.')
            
    return redirect('pedidos:lista_libros')