import os
from django.db import transaction
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q, Count
from django.http import HttpResponse, JsonResponse
from django.core.paginator import Paginator
from django.views.decorators.http import require_POST
from django.template.loader import render_to_string
from django.utils import timezone
from django import forms
from decimal import Decimal
import json
from django.db import models

from config import settings
from proveedores.models import Proveedor
from .models import CodigoDescuento, HistorialEstado, Pedido, ServicioExterno, Book, Estado, LoteServicio
from .services import ServicioPedido, CosteadorPedido
from clientes.models import Cliente
from finanzas.services import ServicioFinanzas
from finanzas.models import MovimientoCaja
from weasyprint import HTML


# ============================================================
# WIDGETS Y FORMULARIO
# ============================================================
class ClienteSelectConTelefono(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value:
            try:
                cliente = Cliente.objects.get(pk=value.value)
                if cliente.telefono:
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
                option['attrs']['data-autor'] = libro.autor or ''
                option['attrs']['data-titulo'] = libro.titulo
            except Book.DoesNotExist:
                pass
        return option


class NuevoPedidoForm(forms.Form):
    cliente = forms.ModelChoiceField(
        queryset=Cliente.objects.all(),
        required=False,
        widget=ClienteSelectConTelefono(attrs={'class': 'form-select'})
    )
    nuevo_cliente_nombre = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre nuevo'}))
    nuevo_cliente_telefono = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Teléfono'}))
    nuevo_cliente_direccion = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Dirección (opcional)'}))
    codigo_descuento = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )
    libro = forms.ModelChoiceField(
        queryset=Book.objects.all(),
        required=False,
        widget=LibroSelectConPaginas(attrs={'class': 'form-select'})
    )
    nuevo_libro_titulo = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Título nuevo'}))
    nuevo_libro_autor = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Autor'}))
    nuevo_libro_paginas = forms.IntegerField(required=False, widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Páginas'}))

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


# ============================================================
# HELPERS
# ============================================================
def _siguiente_referencia():
    """Devuelve el siguiente número de referencia_externa (mayor + 1)."""
    ultima = Pedido.objects.filter(
        referencia_externa__isnull=False
    ).order_by('-referencia_externa').values_list('referencia_externa', flat=True).first()
    return (ultima + 1) if ultima else 1


def _obtener_pedidos_filtrados(request, solo_entregados=False):
    if solo_entregados:
        pedidos_list = Pedido.objects.select_related('cliente', 'libro', 'estado').filter(
            estado__nombre='Entregado'
        ).order_by('-fecha_entrega_real', '-fecha_pedido')
    else:
        pedidos_list = Pedido.objects.select_related('cliente', 'libro', 'estado').exclude(
            estado__nombre__in=['Entregado', 'Cancelado']
        ).order_by('-fecha_pedido')

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


# ============================================================
# LISTAS
# ============================================================
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


def lista_ajax(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=False).order_by('referencia_externa')
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_pedidos.html', {
        'pedidos': page_obj,
        'total_pedidos': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


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


def lista_entregados_ajax(request):
    pedidos_list = _obtener_pedidos_filtrados(request, solo_entregados=True)
    paginator = Paginator(pedidos_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_entregados.html', {
        'pedidos': page_obj,
        'total_pedidos': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


# ============================================================
# DETALLE Y ESTADOS
# ============================================================
def detalle(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    costo = CosteadorPedido(pedido).calcular()

    return render(request, 'pedidos/detalle.html', {
        'pedido': pedido,
        'costo': costo,
        'estados': Estado.objects.all().order_by('orden'),
    })


def cambiar_estado(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado')
        notas = request.POST.get('notas', '')
        if nuevo_estado:
            ServicioPedido.cambiar_estado(pedido, nuevo_estado, usuario=request.user.username, notas=notas)
            messages.success(request, f'Estado cambiado a {nuevo_estado}')
    return redirect('pedidos:detalle', pk=pk)


@require_POST
def cambiar_estado_masivo(request):
    try:
        data = json.loads(request.body)
        pedido_ids = data.get('pedido_ids', [])
        estado_id = data.get('estado_id')

        if not pedido_ids or not estado_id:
            return JsonResponse({'ok': False, 'error': 'Faltan datos'}, status=400)

        try:
            nuevo_estado = Estado.objects.get(id=estado_id)
        except Estado.DoesNotExist:
            return JsonResponse({'ok': False, 'error': 'El estado no existe'}, status=404)

        actualizados = 0
        errores = []

        for pid in pedido_ids:
            try:
                pedido = Pedido.objects.get(id=pid)
                if pedido.estado_id == nuevo_estado.id:
                    continue
                ServicioPedido.cambiar_estado(
                    pedido, nuevo_estado.nombre,
                    usuario=request.user.username, notas='Cambio masivo'
                )
                actualizados += 1
            except Pedido.DoesNotExist:
                errores.append(f'Pedido {pid} no existe')
            except Exception as e:
                errores.append(f'Pedido {pid}: {str(e)}')

        return JsonResponse({
            'ok': True,
            'actualizados': actualizados,
            'estado': nuevo_estado.nombre,
            'errores': errores
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


def confirmar_pedido(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        if pedido.estado.nombre == 'Borrador':
            ServicioPedido.cambiar_estado(
                pedido, 'Pendiente a Anticipo',
                usuario=request.user.username, notas='Cliente confirmó'
            )
            messages.success(request, 'Pedido confirmado. Esperando anticipo.')
    return redirect('pedidos:detalle', pk=pk)


# ============================================================
# ANTICIPOS Y PAGOS
# ============================================================
def registrar_anticipo(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    if request.method == 'POST':
        monto = request.POST.get('monto')
        metodo = request.POST.get('metodo', 'EFECTIVO')
        ServicioFinanzas.registrar_anticipo(pedido, monto=float(monto), metodo=metodo)
        messages.success(request, f'Anticipo registrado: ${monto}')
    return redirect('pedidos:detalle', pk=pk)


# ============================================================
# NUEVO PEDIDO (MODAL)
# ============================================================
def nuevo_pedido_modal(request):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Método no permitido'}, status=405)

    form = NuevoPedidoForm(request.POST)
    if form.is_valid():
        with transaction.atomic():
            # 1. Resolver Cliente
            cliente = form.cleaned_data.get('cliente')
            if not cliente:
                cliente = Cliente.objects.create(
                    nombre=form.cleaned_data['nuevo_cliente_nombre'],
                    telefono=form.cleaned_data.get('nuevo_cliente_telefono', ''),
                    direccion=form.cleaned_data.get('nuevo_cliente_direccion', '')
                )

            # 2. Resolver Libro
            libro = form.cleaned_data.get('libro')
            if not libro:
                libro = Book.objects.create(
                    titulo=form.cleaned_data['nuevo_libro_titulo'],
                    autor=form.cleaned_data.get('nuevo_libro_autor', ''),
                    paginas=form.cleaned_data['nuevo_libro_paginas'],
                    precio=form.cleaned_data.get('precio_venta', 0)
                )

            # 3. Procesar código de descuento
            codigo_str = form.cleaned_data.get('codigo_descuento', '').strip().upper()
            cod_obj = None
            descuento = Decimal('0')

            if codigo_str:
                try:
                    cod_obj = CodigoDescuento.objects.get(codigo__iexact=codigo_str)
                    if not cod_obj.vigente:
                        return JsonResponse({
                            'ok': False,
                            'errors': {'codigo_descuento': ['El código está expirado o inactivo.']}
                        })
                    if not cod_obj.aplica_a_libro(libro):
                        return JsonResponse({
                            'ok': False,
                            'errors': {'codigo_descuento': ['El código no aplica a este libro.']}
                        })
                    descuento = form.cleaned_data['precio_venta'] * (cod_obj.porcentaje / Decimal('100'))
                except CodigoDescuento.DoesNotExist:
                    return JsonResponse({
                        'ok': False,
                        'errors': {'codigo_descuento': ['Código de descuento no válido.']}
                    })

            # 4. Siguiente referencia
            siguiente_ref = _siguiente_referencia()

            # 5. Estado inicial: Pendiente a impresión
            estado_inicial = Estado.objects.get(nombre='Pendiente a impresión')

            # 6. Crear el pedido ya en producción, con descuento
            pedido = Pedido.objects.create(
                cliente=cliente,
                libro=libro,
                cantidad=form.cleaned_data['cantidad'],
                lleva_scotch=form.cleaned_data.get('lleva_scotch', False),
                lleva_esquineros=form.cleaned_data.get('lleva_esquineros', False),
                precio_venta=form.cleaned_data['precio_venta'],
                descuento_aplicado=descuento,
                codigo_descuento=cod_obj,
                anticipo_requerido=form.cleaned_data.get('anticipo_requerido') or 0,
                estado=estado_inicial,
                fecha_entrega_prometida=form.cleaned_data.get('fecha_entrega_prometida'),
                direccion_entrega=form.cleaned_data.get('direccion_entrega', ''),
                telefono_entrega=form.cleaned_data.get('telefono_entrega', ''),
                notas=form.cleaned_data.get('notas', ''),
                referencia_externa=siguiente_ref,
            )

            # 7. Incrementar uso del código
            if cod_obj:
                cod_obj.usos_actuales += 1
                cod_obj.save(update_fields=['usos_actuales'])

            # 8. Registrar el anticipo en caja (si es mayor a 0)
            anticipo = form.cleaned_data.get('anticipo_requerido') or 0
            if anticipo > 0:
                ServicioFinanzas.registrar_anticipo(
                    pedido,
                    monto=anticipo,
                    metodo='EFECTIVO'
                )

            # 9. Registrar el cambio de estado en el historial
            ServicioPedido.cambiar_estado(
                pedido,
                'Pendiente a impresión',
                usuario=request.user.username,
                notas='Pedido creado con anticipo pagado'
            )

        return JsonResponse({'ok': True, 'redirect': f'/pedidos/{pedido.id}/'})

    return JsonResponse({'ok': False, 'errors': form.errors})


# ============================================================
# CÁLCULO DE COSTO
# ============================================================
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


# ============================================================
# LIBROS (CATÁLOGO)
# ============================================================
def lista_libros(request):
    libros_list = Book.objects.annotate(num_pedidos=Count('pedidos')).order_by('titulo')
    busqueda = request.GET.get('q', '').strip()
    if busqueda:
        libros_list = libros_list.filter(
            Q(titulo__icontains=busqueda) | Q(autor__icontains=busqueda)
        )

    paginator = Paginator(libros_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'pedidos/libros_lista.html', {
        'libros': page_obj,
        'busqueda': busqueda,
        'total_libros': paginator.count,
    })


def lista_libros_ajax(request):
    libros_list = Book.objects.annotate(num_pedidos=Count('pedidos')).order_by('titulo')
    busqueda = request.GET.get('q', '').strip()
    if busqueda:
        libros_list = libros_list.filter(
            Q(titulo__icontains=busqueda) | Q(autor__icontains=busqueda)
        )

    paginator = Paginator(libros_list, 10)
    page_obj = paginator.get_page(request.GET.get('page'))

    html = render_to_string('pedidos/_tabla_libros.html', {
        'libros': page_obj,
        'total_libros': paginator.count,
    }, request=request)

    return JsonResponse({'html': html})


def editar_libro(request, pk):
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


# ============================================================
# STOCK
# ============================================================
def fabricar_para_stock(request, libro_id):
    libro = get_object_or_404(Book, pk=libro_id)

    if request.method == 'POST':
        cantidad = int(request.POST.get('cantidad', 1))
        estado_borrador = Estado.objects.get(nombre='Borrador')
        siguiente = _siguiente_referencia()

        for i in range(cantidad):
            Pedido.objects.create(
                cliente=None,
                libro=libro,
                cantidad=1,
                precio_venta=libro.precio,
                anticipo_requerido=0,
                estado=estado_borrador,
                notas='Pedido creado para stock (Venta Directa)',
                referencia_externa=siguiente + i,
            )

        messages.success(request, f'Se crearon {cantidad} pedidos de "{libro.titulo}" para stock.')
        return redirect('pedidos:lista')

    return render(request, 'pedidos/fabricar_stock.html', {'libro': libro})


def asignar_cliente_y_cobrar(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)

    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        metodo = request.POST.get('metodo_pago', 'EFECTIVO')

        if not cliente_id:
            messages.error(request, 'Debes seleccionar un cliente.')
            return redirect('pedidos:detalle', pk=pedido.id)

        cliente = get_object_or_404(Cliente, id=cliente_id)

        with transaction.atomic():
            pedido.cliente = cliente
            pedido.save()

            if pedido.saldo_pendiente > 0:
                ServicioFinanzas.registrar_saldo(pedido, monto=pedido.saldo_pendiente, metodo=metodo)

            ServicioPedido.cambiar_estado(
                pedido, 'Entregado',
                usuario=request.user.username, notas='Venta directa de stock'
            )

        messages.success(request, f'Pedido #{pedido.id} vendido a {cliente.nombre} por ${pedido.precio_venta}.')
        return redirect('pedidos:detalle', pk=pedido.id)

    clientes = Cliente.objects.all().order_by('nombre')
    return render(request, 'pedidos/asignar_cliente.html', {
        'pedido': pedido,
        'clientes': clientes
    })


# ============================================================
# IMPRESIÓN
# ============================================================
def imprimir_pedido(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_pedido.html', {'pedido': pedido})


def imprimir_orden_servicio(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_orden_servicio.html', {'pedido': pedido})


def imprimir_comprobantes_masivo(request):
    ids = request.GET.getlist('ids')
    if not ids:
        messages.error(request, 'No seleccionaste pedidos para imprimir.')
        return redirect('pedidos:lista')

    pedidos = Pedido.objects.filter(id__in=ids).select_related(
        'cliente', 'libro', 'estado'
    ).order_by('cliente__nombre', 'fecha_pedido', 'id')

    total_venta = sum(p.precio_venta for p in pedidos)
    total_anticipo = sum(p.anticipo_recibido for p in pedidos)
    total_saldo = sum(p.saldo_pendiente for p in pedidos)

    clientes = set(p.cliente_id for p in pedidos)
    un_solo_cliente = len(clientes) == 1

    return render(request, 'pedidos/imprimir_comprobantes_lote.html', {
        'pedidos': pedidos,
        'cantidad': pedidos.count(),
        'total_venta': total_venta,
        'total_anticipo': total_anticipo,
        'total_saldo': total_saldo,
        'un_solo_cliente': un_solo_cliente,
    })


# ============================================================
# LOTES DE SERVICIO
# ============================================================
def lista_lotes(request):
    """Lista de lotes con dos pestañas: abiertos e historial, con filtros."""
    from django.db.models import Q, Sum, Count

    # Pestaña activa
    tab = request.GET.get('tab', 'abiertos')

    # Filtros comunes
    q = request.GET.get('q', '').strip()
    proveedor_id = request.GET.get('proveedor', '')
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')

    # Base queryset
    lotes = LoteServicio.objects.select_related('proveedor').annotate(
        num_servicios=Count('servicios'),
        total=Sum('servicios__monto'),
    ).order_by('-fecha_apertura')

    # Filtrar por pestaña
    if tab == 'abiertos':
        lotes = lotes.filter(estado='ABIERTO')
    else:
        # Historial: todos los que no están abiertos
        lotes = lotes.exclude(estado='ABIERTO')

    # Filtros
    if q:
        lotes = lotes.filter(
            Q(numero__icontains=q) |
            Q(proveedor__nombre__icontains=q)
        )
    if proveedor_id:
        lotes = lotes.filter(proveedor_id=proveedor_id)
    if tipo:
        lotes = lotes.filter(tipo=tipo)
    if estado:
        lotes = lotes.filter(estado=estado)
    if desde:
        lotes = lotes.filter(fecha_apertura__date__gte=desde)
    if hasta:
        lotes = lotes.filter(fecha_apertura__date__lte=hasta)

    # Datos para los selects
    proveedores = Proveedor.objects.filter(activo=True).order_by('nombre')
    tipos = LoteServicio._meta.get_field('tipo').choices
    estados = LoteServicio._meta.get_field('estado').choices

    return render(request, 'pedidos/lista_lotes.html', {
        'lotes': lotes,
        'tab': tab,
        'proveedores': proveedores,
        'tipos': tipos,
        'estados': estados,
        'q': q,
        'proveedor_id': proveedor_id,
        'tipo_actual': tipo,
        'estado_actual': estado,
        'desde': desde,
        'hasta': hasta,
    })


def detalle_lote(request, pk):
    lote = get_object_or_404(LoteServicio, pk=pk)
    servicios = lote.servicios.select_related('pedido__libro', 'pedido__cliente').all()
    return render(request, 'pedidos/detalle_lote.html', {
        'lote': lote,
        'servicios': servicios,
    })


def cerrar_lote(request, pk):
    lote = get_object_or_404(LoteServicio, pk=pk)
    if request.method == 'POST' and lote.estado == 'ABIERTO':
        lote.estado = 'CERRADO'
        lote.fecha_cierre = timezone.now()
        lote.save()
        messages.success(request, f'Lote {lote.numero} cerrado con {lote.cantidad_servicios} servicios. Total: ${lote.costo_total}')
    return redirect('pedidos:detalle_lote', pk=lote.id)


def pagar_lote(request, pk):
    lote = get_object_or_404(LoteServicio, pk=pk)
    if request.method == 'POST' and lote.estado == 'CERRADO':
        with transaction.atomic():
            for servicio in lote.servicios.filter(estado__in=['SOLICITADO', 'RECIBIDO']):
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria='PAGO_PROVEEDOR',
                    monto=servicio.monto,
                    concepto=f'Pago {servicio.get_tipo_display()} - Pedido #{servicio.pedido.id} ({lote.numero})',
                    proveedor=lote.proveedor,
                    pedido=servicio.pedido
                )
                servicio.estado = 'PAGADO'
                servicio.fecha_pago = timezone.now()
                servicio.save()

            lote.estado = 'PAGADO'
            lote.fecha_pago = timezone.now()
            lote.save()

        messages.success(request, f'Lote {lote.numero} pagado. Total: ${lote.costo_total}')
        return redirect('pedidos:detalle_lote', pk=lote.id)

    return redirect('pedidos:detalle_lote', pk=lote.id)


def orden_lote_pdf(request, pk):
    lote = get_object_or_404(LoteServicio, pk=pk)
    servicios = lote.servicios.select_related(
        'pedido__libro', 'pedido__cliente'
    ).order_by('pedido_id')

    # Rutas absolutas para WeasyPrint
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'logo.png')
    sello_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'sello_pagado.png')

    html_string = render_to_string('pedidos/orden_lote_pdf.html', {
        'lote': lote,
        'servicios': servicios,
        'logo_path': f'file:///{logo_path.replace(os.sep, "/")}',
        'sello_path': f'file:///{sello_path.replace(os.sep, "/")}',
    }, request=request)

    pdf = HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf()

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="orden-{lote.numero}.pdf"'
    return response

def imprimir_comprobante_termico(request, pk):
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'logo.png')
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_comprobante_termico.html', {
        'pedido': pedido,
        'logo_path': f'file:///{logo_path.replace(os.sep, "/")}',
        })

def imprimir_comprobantes_termico(request):
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'img', 'logo.png')
    """Genera un ticket térmico consolidado con varios pedidos seleccionados."""
    ids = request.GET.getlist('ids')
    if not ids:
        messages.error(request, 'No seleccionaste pedidos para imprimir.')
        return redirect('pedidos:lista')

    pedidos = Pedido.objects.filter(id__in=ids).select_related(
        'cliente', 'libro', 'estado'
    ).order_by('cliente__nombre', 'fecha_pedido', 'id')

    if not pedidos.exists():
        messages.error(request, 'No se encontraron pedidos con esos IDs.')
        return redirect('pedidos:lista')

    total_venta = sum(p.precio_venta for p in pedidos)
    total_anticipo = sum(p.anticipo_recibido for p in pedidos)
    total_saldo = sum(p.saldo_pendiente for p in pedidos)

    clientes = set(p.cliente_id for p in pedidos)
    un_solo_cliente = len(clientes) == 1

    return render(request, 'pedidos/imprimir_comprobantes_termico.html', {
        'pedidos': pedidos,
        'cantidad': pedidos.count(),
        'total_venta': total_venta,
        'total_anticipo': total_anticipo,
        'total_saldo': total_saldo,
        'un_solo_cliente': un_solo_cliente,
        'logo_path': f'file:///{logo_path.replace(os.sep, "/")}',
    })

def imprimir_pedido_carta(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    return render(request, 'pedidos/imprimir_pedido_carta.html', {'pedido': pedido})


def imprimir_comprobantes_lote_carta(request):
    ids = request.GET.getlist('ids')
    if not ids:
        messages.error(request, 'No seleccionaste pedidos para imprimir.')
        return redirect('pedidos:lista')

    pedidos = Pedido.objects.filter(id__in=ids).select_related(
        'cliente', 'libro', 'estado'
    ).order_by('cliente__nombre', 'fecha_pedido', 'id')

    if not pedidos.exists():
        messages.error(request, 'No se encontraron pedidos con esos IDs.')
        return redirect('pedidos:lista')

    total_venta = sum(p.precio_venta for p in pedidos)
    total_anticipo = sum(p.anticipo_recibido for p in pedidos)
    total_saldo = sum(p.saldo_pendiente for p in pedidos)

    return render(request, 'pedidos/imprimir_comprobantes_lote_carta.html', {
        'pedidos': pedidos,
        'cantidad': pedidos.count(),
        'total_venta': total_venta,
        'total_anticipo': total_anticipo,
        'total_saldo': total_saldo,
    })

def validar_codigo_descuento(request):
    """Valida un código de descuento y devuelve el porcentaje y el nuevo precio."""
    codigo = request.GET.get('codigo', '').strip().upper()
    precio = Decimal(request.GET.get('precio', 0))
    libro_id = request.GET.get('libro_id')

    if not codigo:
        return JsonResponse({'ok': False, 'error': 'Ingresa un código'})

    try:
        cod = CodigoDescuento.objects.get(codigo__iexact=codigo)
    except CodigoDescuento.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Código no válido'})

    if not cod.vigente:
        return JsonResponse({'ok': False, 'error': 'Código expirado o inactivo'})

    # Verificar condición por libro
    if libro_id:
        try:
            libro = Book.objects.get(id=libro_id)
            if not cod.aplica_a_libro(libro):
                return JsonResponse({'ok': False, 'error': 'El código no aplica a este libro'})
        except Book.DoesNotExist:
            pass

    # Calcular descuento
    descuento = precio * (cod.porcentaje / Decimal('100'))
    precio_final = precio - descuento

    return JsonResponse({
        'ok': True,
        'porcentaje': float(cod.porcentaje),
        'descuento': float(descuento),
        'precio_final': float(precio_final),
        'descripcion': cod.descripcion,
    })

def codigos_vigentes(request):
    """Devuelve los códigos de descuento activos y vigentes."""
    from django.utils import timezone
    hoy = timezone.now().date()

    codigos = CodigoDescuento.objects.filter(activo=True).filter(
        Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=hoy)
    ).filter(
        Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy)
    ).filter(
        Q(usos_maximos__isnull=True) | Q(usos_actuales__lt=models.F('usos_maximos'))
    ).order_by('codigo')

    data = [{
        'id': c.id,
        'codigo': c.codigo,
        'descripcion': c.descripcion,
        'porcentaje': float(c.porcentaje),
        'categoria': c.categoria,
    } for c in codigos]

    return JsonResponse({'ok': True, 'codigos': data})

from .models import Entrega

def lista_entregas(request):
    """Lista todas las entregas."""
    entregas = Entrega.objects.select_related('cliente').prefetch_related('pedidos').order_by('-fecha_creacion')
    return render(request, 'pedidos/lista_entregas.html', {'entregas': entregas})


def crear_entrega(request):
    """Crea una entrega a partir de pedidos seleccionados."""
    if request.method == 'POST':
        pedido_ids = request.POST.getlist('pedido_ids')
        direccion = request.POST.get('direccion', '')
        costo_mensajeria = Decimal(request.POST.get('costo_mensajeria', 0) or 0)
        fecha_entrega = request.POST.get('fecha_entrega') or None
        notas = request.POST.get('notas', '')

        if not pedido_ids:
            messages.error(request, 'Debes seleccionar al menos un pedido.')
            return redirect('pedidos:crear_entrega')

        pedidos = Pedido.objects.filter(id__in=pedido_ids).select_related('cliente')

        if not pedidos.exists():
            messages.error(request, 'No se encontraron pedidos.')
            return redirect('pedidos:crear_entrega')

        # Verificar que todos sean del mismo cliente
        clientes = set(p.cliente_id for p in pedidos if p.cliente_id)
        if len(clientes) > 1:
            messages.error(request, 'Todos los pedidos deben ser del mismo cliente.')
            return redirect('pedidos:crear_entrega')

        if not clientes:
            messages.error(request, 'Los pedidos deben tener un cliente asignado.')
            return redirect('pedidos:crear_entrega')

        cliente = pedidos.first().cliente

        with transaction.atomic():
            entrega = Entrega.objects.create(
                cliente=cliente,
                direccion=direccion,
                costo_mensajeria=costo_mensajeria,
                fecha_entrega=fecha_entrega,
                notas=notas,
            )
            entrega.pedidos.set(pedidos)

        messages.success(request, f'Entrega #{entrega.id} creada con {pedidos.count()} pedidos de {cliente.nombre}.')
        return redirect('pedidos:detalle_entrega', pk=entrega.id)

    # GET: pedidos disponibles
    pedidos_disponibles = Pedido.objects.filter(
        estado__nombre='Listo para Entregar',
        cliente__isnull=False,           # <-- solo con cliente
    ).exclude(
        entregas__isnull=False           # <-- que no estén ya en una entrega
    ).select_related('cliente', 'libro', 'estado').order_by('referencia_externa')

    return render(request, 'pedidos/crear_entrega.html', {
        'pedidos_disponibles': pedidos_disponibles,
    })


def detalle_entrega(request, pk):
    entrega = get_object_or_404(Entrega, pk=pk)
    pedidos = entrega.pedidos.select_related('libro', 'cliente', 'estado').all()

    if request.method == 'POST':
        accion = request.POST.get('accion')
        if accion == 'entregar':
            with transaction.atomic():
                entrega.entregado = True
                entrega.fecha_entrega_real = timezone.now()
                entrega.save()

                # Cambiar estado de cada pedido a "Entregado"
                for pedido in pedidos:
                    if pedido.estado.nombre != 'Entregado':
                        ServicioPedido.cambiar_estado(
                            pedido,
                            'Entregado',
                            usuario=request.user.username,
                            notas=f'Entrega #{entrega.id} marcada como entregada'
                        )

                # Cobrar la mensajería en caja (si tiene costo)
                if entrega.costo_mensajeria > 0:
                    from finanzas.models import MovimientoCaja
                    MovimientoCaja.objects.create(
                        tipo='INGRESO',
                        categoria='MENSAJERIA',
                        monto=entrega.costo_mensajeria,
                        concepto=f'Mensajería entrega #{entrega.id} - {entrega.cliente.nombre}',
                        cliente=entrega.cliente
                    )

            messages.success(request, f'Entrega #{entrega.id} marcada como entregada. {pedidos.count()} pedidos actualizados.')
        elif accion == 'actualizar':
            entrega.direccion = request.POST.get('direccion', '')
            entrega.costo_mensajeria = Decimal(request.POST.get('costo_mensajeria', 0) or 0)
            entrega.fecha_entrega = request.POST.get('fecha_entrega') or None
            entrega.notas = request.POST.get('notas', '')
            entrega.save()
            messages.success(request, 'Entrega actualizada.')
        return redirect('pedidos:detalle_entrega', pk=entrega.id)

    return render(request, 'pedidos/detalle_entrega.html', {
        'entrega': entrega,
        'pedidos': pedidos,
    })


def imprimir_entrega(request, pk):
    """Genera el comprobante de la entrega."""
    entrega = get_object_or_404(Entrega, pk=pk)
    pedidos = entrega.pedidos.select_related('libro', 'cliente').all()

    return render(request, 'pedidos/imprimir_entrega.html', {
        'entrega': entrega,
        'pedidos': pedidos,
    })

def agregar_esquineros(request, pk):
    """Marca el pedido como que lleva esquineros y los consume del inventario."""
    pedido = get_object_or_404(Pedido, pk=pk)
    
    if request.method == 'POST' and not pedido.lleva_esquineros:
        with transaction.atomic():
            pedido.lleva_esquineros = True
            pedido.save(update_fields=['lleva_esquineros'])
            
            # Consumir esquineros del inventario
            ServicioPedido.consumir_materiales(pedido, momento='ENTREGA')
            
            # Registrar en historial
            HistorialEstado.objects.create(
                pedido=pedido,
                estado_anterior=pedido.estado,
                estado_nuevo=pedido.estado,
                usuario=request.user.username,
                notas='Se agregaron esquineros al pedido'
            )
        
        messages.success(request, f'Esquineros agregados al pedido #{pedido.referencia_externa or pedido.id}.')
    
    return redirect('pedidos:detalle', pk=pedido.id)

def imprimir_entrega_carta(request, pk):
    """Genera el comprobante de entrega en formato pequeño (5x8cm)."""
    entrega = get_object_or_404(Entrega, pk=pk)
    pedidos = entrega.pedidos.select_related('libro', 'cliente').all()

    return render(request, 'pedidos/imprimir_entrega_carta.html', {
        'entrega': entrega,
        'pedidos': pedidos,
    })