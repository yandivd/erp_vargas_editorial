from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse
from django import forms
from decimal import Decimal

from .models import Pedido, ServicioExterno, Book, Estado
from .services import ServicioPedido, CosteadorPedido
from clientes.models import Cliente
from finanzas.services import ServicioFinanzas

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
    cliente = forms.ModelChoiceField(queryset=Cliente.objects.all(), required=False, widget=forms.Select(attrs={'class': 'form-select'}))
    nuevo_cliente_nombre = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre nuevo'}))
    nuevo_cliente_telefono = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Teléfono'}))
    
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


def lista(request):
    pedidos = Pedido.objects.select_related('cliente', 'libro', 'estado').all()
    
    estado_id = request.GET.get('estado', '')
    busqueda = request.GET.get('q', '')
    
    if estado_id:
        pedidos = pedidos.filter(estado_id=estado_id)
    if busqueda:
        pedidos = pedidos.filter(
            Q(libro__titulo__icontains=busqueda) |
            Q(libro__autor__icontains=busqueda) |
            Q(cliente__nombre__icontains=busqueda)
        )
    
    pedidos = list(pedidos.order_by('-fecha_pedido'))
    
    context = {
        'pedidos': pedidos,
        'estados': Estado.objects.all().order_by('orden'),
        'estado_actual': estado_id,
        'busqueda': busqueda,
        'form': NuevoPedidoForm(),
    }
    return render(request, 'pedidos/lista.html', context)


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
                telefono=form.cleaned_data.get('nuevo_cliente_telefono', '')
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