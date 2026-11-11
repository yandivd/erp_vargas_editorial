from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import (
    Q,
    Count,
    Sum,
    F,
    IntegerField,
    ProtectedError,
)
from django.db.models.functions import Cast
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from clientes.models import Cliente
from core.api import obtener_dashboard_data
from core.api_utils import payload_paginacion
from core.models import Parametro
from core.services import (
    CATEGORIA_VUELTO_CLIENTE,
    Q_NO_EGRESO_OPERATIVO,
    Q_NO_INGRESO_OPERATIVO,
    depreciacion_activos_mensual,
    parse_fecha,
)
from empleados.models import Empleado, PagoNomina
from finanzas.models import ActivoFijo, CierreCaja, GastoOperativo, MovimientoCaja
from finanzas.services import ServicioFinanzas
from inventario.models import Material, MovimientoInventario
from pedidos.models import (
    Book,
    CodigoDescuento,
    Entrega,
    Estado,
    LoteServicio,
    Pedido,
    ServicioExterno,
)
from pedidos.services import CosteadorPedido, ServicioPedido
from proveedores.models import Proveedor

from .serializers import (
    ESTADOS_NO_TALLER,
    ActivoFijoV1Serializer,
    AnticipoV1Serializer,
    CambiarEstadoMasivoSerializer,
    CambiarEstadoSerializer,
    CierreCajaV1Serializer,
    ClienteCreateV1Serializer,
    ClienteDetailV1Serializer,
    ClienteListV1Serializer,
    ConfirmarEntregaSerializer,
    EmpleadoV1Serializer,
    CrearEntregaSerializer,
    EntregaDetailV1Serializer,
    EntregaListV1Serializer,
    EstadoV1Serializer,
    LibroListV1Serializer,
    LoteServicioV1Serializer,
    MovimientoCajaV1Serializer,
    PagarEmpleadoSerializer,
    PagoNominaV1Serializer,
    PedidoCreateSerializer,
    PedidoDetailV1Serializer,
    PedidoListV1Serializer,
    ProveedorV1Serializer,
    RegistrarAnticipoSerializer,
    RegistrarArqueoSerializer,
    RegistrarCompraDivisaSerializer,
    RegistrarMovimientoCajaSerializer,
    RegistrarVentaDivisaSerializer,
    TiendaPedidoSerializer,
)


def _rol_usuario(user):
    if user.is_superuser:
        return 'admin'
    if user.is_staff:
        return 'staff'
    grupo = user.groups.first()
    return grupo.name if grupo else 'usuario'


def _nombre_usuario(user):
    if not user:
        return ''
    nombre = user.get_full_name().strip()
    return nombre or user.username


def _nombre_por_grupo(grupos, fallback=''):
    User = get_user_model()
    for grupo in grupos:
        user = (
            User.objects.filter(groups__name__iexact=grupo)
            .order_by('id')
            .first()
        )
        if user:
            return _nombre_usuario(user)
    return fallback


def _es_verdadero(value):
    return value.strip().lower() in ('1', 'true', 'yes', 'si', 'sí')


def _mes_actual_texto():
    meses = (
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    )
    hoy = timezone.localdate()
    return f'{meses[hoy.month - 1]} {hoy.year}'


def _parametros_costo():
    material_esquineros = Material.objects.filter(
        nombre__iexact='esquineros'
    ).first()
    return {
        'paginas_por_hoja': int(Parametro.get('paginas_por_hoja', 4)),
        'precio_papel_paquete': float(Parametro.get('precio_papel_paquete', 1800)),
        'hojas_por_paquete': float(Parametro.get('hojas_por_paquete', 500)),
        'precio_tinta_litro': float(Parametro.get('precio_tinta_litro', 17500)),
        'rinde_tinta_paginas': float(Parametro.get('rinde_tinta_paginas', 35000)),
        'precio_pegamento': float(Parametro.get('precio_pegamento', 3500)),
        'rinde_pegamento_lomos': float(Parametro.get('rinde_pegamento_lomos', 70)),
        'esquineros_por_libro': float(Parametro.get('esquineros_por_libro', 4)),
        'costo_esquineros_material': (
            float(material_esquineros.costo_promedio)
            if material_esquineros
            else 0
        ),
        'precio_scotch': float(Parametro.get('precio_scotch', 1000)),
        'rinde_scotch_libros': float(Parametro.get('rinde_scotch_libros', 30)),
        'precio_portada': float(Parametro.get('precio_portada', 1000)),
        'paginas_para_grueso': float(Parametro.get('paginas_para_grueso', 300)),
        'precio_encuadernacion': float(Parametro.get('precio_encuadernacion', 500)),
        'precio_encuadernacion_grueso': float(Parametro.get('precio_encuadernacion_grueso', 500)),
        'electricidad_mensual': float(Parametro.get('electricidad_mensual', 1000)),
        'libros_por_mes_estimado': float(Parametro.get('libros_por_mes_estimado', 30)),
        'precio_diseno': float(Parametro.get('precio_diseno', 500)),
        'paginas_min': float(Parametro.get('paginas_min', 100)),
        'paginas_max': float(Parametro.get('paginas_max', 1000)),
        'margen_min': float(Parametro.get('margen_min', 0.8)),
        'margen_max': float(Parametro.get('margen_max', 2.0)),
    }


def _calcular_costo_paginas(paginas, lleva_scotch=False, lleva_esquineros=False):
    libro_temp = Book(paginas=paginas)
    pedido_temp = Pedido(
        libro=libro_temp,
        lleva_scotch=lleva_scotch,
        lleva_esquineros=lleva_esquineros,
        cantidad=1,
        precio_venta=0,
    )
    costeador = CosteadorPedido(pedido_temp)
    resultado = costeador.calcular()
    precio_sugerido = costeador.calcular_precio_sugerido()
    resultado['paginas'] = paginas
    resultado['precio_sugerido'] = float(precio_sugerido)
    resultado['anticipo_sugerido'] = float(round(precio_sugerido / 2, 2))
    return resultado


def _primer_error_serializer(errors):
    for value in errors.values():
        if isinstance(value, (list, tuple)) and value:
            return str(value[0])
        return str(value)
    return 'Datos inválidos.'


def _siguiente_referencia():
    ultima = (
        Pedido.objects.filter(referencia_externa__regex=r'^\d+$')
        .annotate(ref_num=Cast('referencia_externa', output_field=IntegerField()))
        .order_by('-ref_num')
        .values_list('ref_num', flat=True)
        .first()
    )
    return (ultima + 1) if ultima else 1


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'rol': _rol_usuario(user),
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'groups': list(user.groups.values_list('name', flat=True)),
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def dashboard(request, tab='resumen'):
    try:
        data = obtener_dashboard_data(
            tab,
            request.GET.get('desde', ''),
            request.GET.get('hasta', ''),
        )
    except ValueError as error:
        return Response(
            {'ok': False, 'error': str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({'ok': True, 'data': data})


class CatalogoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'per_page'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'ok': True,
            'data': data,
            'pagination': {
                'count': self.page.paginator.count,
                'page': self.page.number,
                'num_pages': self.page.paginator.num_pages,
                'per_page': self.page.paginator.per_page,
                'start_index': self.page.start_index(),
                'end_index': self.page.end_index(),
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            },
        })


@api_view(['GET'])
@permission_classes([AllowAny])
def catalogo(request):
    libros = Book.objects.all().order_by('titulo', 'id')
    busqueda = request.query_params.get('q', '').strip()
    if busqueda:
        libros = libros.filter(
            Q(titulo__icontains=busqueda) | Q(autor__icontains=busqueda)
        )

    paginador = CatalogoPagination()
    pagina = paginador.paginate_queryset(libros, request, view=catalogo)
    data = [
        {
            'id': libro.id,
            'titulo': libro.titulo,
            'autor': libro.autor or '',
            'descripcion': libro.descripcion or '',
            'paginas': libro.paginas,
            'precio': str(libro.precio),
            'imagen': (
                request.build_absolute_uri(libro.imagen.url)
                if libro.imagen
                else None
            ),
        }
        for libro in pagina
    ]

    return paginador.get_paginated_response(data)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inventario(request):
    busqueda = request.query_params.get('search', '').strip()
    materiales = Material.objects.filter(activo=True).order_by('nombre')

    if busqueda:
        materiales = materiales.filter(Q(nombre__icontains=busqueda))

    paginador = Paginator(materiales, int(request.query_params.get('per_page') or 20))
    pagina = paginador.get_page(request.query_params.get('page'))

    data = [
        {
            'id': material.id,
            'nombre': material.nombre,
            'unidad_medida': material.unidad_medida,
            'stock_actual': float(material.stock_actual),
            'stock_minimo': float(material.stock_minimo),
            'stock_bajo': bool(material.stock_bajo),
            'alerta': bool(material.stock_bajo),
        }
        for material in pagina
    ]

    return Response({
        'ok': True,
        'data': {'materiales': data},
        'pagination': {
            'count': paginador.count,
            'page': pagina.number,
            'num_pages': paginador.num_pages,
            'per_page': paginador.per_page,
            'start_index': pagina.start_index() if paginador.count else 0,
            'end_index': pagina.end_index() if paginador.count else 0,
            'has_next': pagina.has_next(),
            'has_previous': pagina.has_previous(),
        },
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inventario_movimiento(request):
    try:
        material_id = int(request.data.get('material_id'))
        tipo = str(request.data.get('tipo') or '').strip().upper()
        cantidad = Decimal(str(request.data.get('cantidad') or 0))
        motivo = str(request.data.get('motivo') or '')
        pedido_id = request.data.get('pedido_id') or None
        costo_unitario = Decimal(str(request.data.get('costo_unitario') or 0))
        proveedor_id = request.data.get('proveedor_id') or None
    except (ValueError, TypeError, InvalidOperation):
        return Response(
            {'ok': False, 'error': 'Datos inválidos para el movimiento de inventario.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if tipo not in ('ENTRADA', 'SALIDA'):
        return Response(
            {'ok': False, 'error': 'El tipo debe ser ENTRADA o SALIDA.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if cantidad <= 0:
        return Response(
            {'ok': False, 'error': 'La cantidad debe ser mayor a cero.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    material = get_object_or_404(Material, id=material_id)

    proveedor = None
    if proveedor_id is not None and str(proveedor_id) != '':
        proveedor = get_object_or_404(Proveedor, id=proveedor_id)

    if tipo == 'SALIDA' and cantidad > material.stock_actual:
        return Response(
            {'ok': False, 'error': 'No hay suficiente stock para la salida.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pedido = None
    if tipo == 'SALIDA' and pedido_id is not None and str(pedido_id) != '':
        pedido = get_object_or_404(Pedido, id=pedido_id)

    with transaction.atomic():
        movimiento = MovimientoInventario.objects.create(
            material=material,
            tipo=tipo,
            cantidad=cantidad,
            costo_unitario=(
                material.costo_promedio
                if tipo == 'SALIDA'
                else (costo_unitario if costo_unitario > 0 else material.costo_promedio)
            ),
            pedido=pedido,
            motivo=motivo,
            usuario=request.user,
        )

        if tipo == 'ENTRADA' and costo_unitario > 0:
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='COMPRA_MATERIAL',
                monto=cantidad * costo_unitario,
                metodo='EFECTIVO',
                concepto=f'Compra de {material.nombre} ({cantidad} {material.unidad_medida})',
                proveedor=proveedor,
            )

    return Response({
        'ok': True,
        'data': {
            'movimiento': {
                'id': movimiento.id,
                'tipo': movimiento.tipo,
                'cantidad': float(movimiento.cantidad),
                'costo_total': float(movimiento.costo_total),
                'motivo': movimiento.motivo,
                'pedido_id': movimiento.pedido_id,
            },
            'material': {
                'id': material.id,
                'stock_actual': float(material.stock_actual),
                'stock_minimo': float(material.stock_minimo),
                'stock_bajo': bool(material.stock_bajo),
                'alerta': bool(material.stock_bajo),
            },
        },
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inventario_historial(request, material_id):
    material = get_object_or_404(Material, id=material_id)
    movimientos = (
        MovimientoInventario.objects.filter(material=material)
        .select_related('pedido', 'usuario')
        .order_by('-fecha')
    )

    data = [
        {
            'id': movimiento.id,
            'fecha': movimiento.fecha.isoformat(),
            'tipo': movimiento.tipo,
            'tipo_label': movimiento.get_tipo_display(),
            'cantidad': float(movimiento.cantidad),
            'costo_unitario': float(movimiento.costo_unitario),
            'costo_total': float(movimiento.costo_total),
            'motivo': movimiento.motivo,
            'pedido': (
                {
                    'id': movimiento.pedido_id,
                    'referencia_externa': movimiento.pedido.referencia_externa,
                }
                if movimiento.pedido_id
                else None
            ),
            'usuario': (
                {
                    'id': movimiento.usuario_id,
                    'nombre': _nombre_usuario(movimiento.usuario),
                }
                if movimiento.usuario_id
                else None
            ),
        }
        for movimiento in movimientos
    ]

    return Response({
        'ok': True,
        'data': {
            'material': {
                'id': material.id,
                'nombre': material.nombre,
                'unidad_medida': material.unidad_medida,
                'stock_actual': float(material.stock_actual),
                'stock_minimo': float(material.stock_minimo),
                'stock_bajo': bool(material.stock_bajo),
            },
            'movimientos': data,
        },
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inventario_orden_trabajo(request, movimiento_id):
    movimiento = get_object_or_404(
        MovimientoInventario.objects.select_related(
            'material',
            'pedido',
            'usuario',
        ),
        id=movimiento_id,
    )
    solicitante = _nombre_usuario(movimiento.usuario)
    almacenero = _nombre_por_grupo(
        ('ALMACENERO', 'ALMACEN', 'ALMACÉN'),
        fallback=getattr(settings, 'ALMACENERO_NOMBRE', '') or solicitante,
    )
    ceo = _nombre_por_grupo(
        ('CEO', 'GERENTE', 'DIRECTOR'),
        fallback=getattr(settings, 'CEO_NOMBRE', ''),
    )

    return Response({
        'ok': True,
        'data': {
            'movimiento': {
                'id': movimiento.id,
                'tipo': movimiento.tipo,
                'tipo_label': movimiento.get_tipo_display(),
                'fecha': movimiento.fecha.isoformat(),
                'cantidad': float(movimiento.cantidad),
                'motivo': movimiento.motivo,
            },
            'material': {
                'id': movimiento.material_id,
                'nombre': movimiento.material.nombre,
                'unidad_medida': movimiento.material.unidad_medida,
            },
            'pedido': (
                {
                    'id': movimiento.pedido_id,
                    'referencia_externa': movimiento.pedido.referencia_externa,
                }
                if movimiento.pedido_id
                else None
            ),
            'solicitante': solicitante,
            'almacenero': almacenero,
            'ceo': ceo,
        },
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tienda(request):
    pedidos = (
        Pedido.objects.filter(
            estado__nombre='En Stock',
            cliente__isnull=True,
        )
        .select_related('cliente', 'libro', 'estado')
        .order_by('-fecha_pedido')
    )
    data = TiendaPedidoSerializer(pedidos, many=True, context={'request': request}).data
    return Response({'ok': True, 'data': data})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tienda_vender(request, pk):
    pedido = get_object_or_404(Pedido, pk=pk)
    monto_cup = Decimal(str(request.data.get('monto_cup') or 0))
    monto_usd = Decimal(str(request.data.get('monto_usd') or 0))
    tasa_aplicada = request.data.get('tasa_aplicada')
    metodo = request.data.get('metodo') or 'EFECTIVO'
    cliente_id = request.data.get('cliente_id')

    resultado = ServicioPedido.vender_stock(
        pedido,
        monto_cup=monto_cup,
        monto_usd=monto_usd,
        tasa_aplicada=tasa_aplicada,
        metodo=metodo,
        usuario=request.user.username,
        notas=request.data.get('notas') or 'Venta en tienda',
        cliente_id=cliente_id,
    )

    return Response({
        'ok': True,
        'data': {
            'pedido': PedidoDetailV1Serializer(pedido).data,
            # Convertimos el objeto MovimientoCaja a un diccionario
            'movimiento': {
                'id': resultado['movimiento'].id,
                'monto': float(resultado['movimiento'].monto),
                'moneda': resultado['movimiento'].moneda,
                'concepto': resultado['movimiento'].concepto,
            },
            # Hacemos lo mismo con la lista de movimientos (si existe)
            'movimientos': [
                {
                    'id': mov.id,
                    'monto': float(mov.monto),
                    'moneda': mov.moneda,
                    'concepto': mov.concepto,
                }
                for mov in resultado['movimientos']
            ],
            'monto_cup': float(resultado['monto_cup']),
            'monto_usd': float(resultado['monto_usd']),
            'total_cup': float(resultado['total_cup']),
            'aplicado_cup': float(resultado['aplicado_cup']),
            'vuelto_cup': float(resultado['vuelto_cup']),
            'tasa': float(resultado['tasa']) if resultado['tasa'] is not None else None,
        },
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def entregas(request):
    tab = request.query_params.get('tab', 'pendientes')
    queryset = (
        Entrega.objects.select_related('cliente')
        .prefetch_related('pedidos')
        .order_by('-fecha_creacion')
    )

    if tab == 'historial':
        queryset = queryset.filter(entregado=True)
    elif tab == 'pendientes':
        queryset = queryset.filter(entregado=False)

    data = EntregaListV1Serializer(queryset, many=True).data
    return Response({'ok': True, 'data': data})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def entrega_pedidos_disponibles(request):
    pedidos = (
        Pedido.objects.filter(
            estado__nombre='Listo para Entregar',
            cliente__isnull=False,
        )
        .exclude(entregas__isnull=False)
        .select_related('cliente', 'libro', 'estado')
        .order_by(
            'cliente__nombre',
            F('referencia_externa').asc(nulls_last=True),
            'id',
        )
    )
    return Response({
        'ok': True,
        'data': PedidoListV1Serializer(pedidos, many=True).data,
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def entrega_detalle(request, pk):
    entrega = get_object_or_404(
        Entrega.objects.select_related('cliente').prefetch_related(
            'pedidos__libro',
            'pedidos__estado',
            'pedidos__cliente',
            'pedidos__servicios_externos__proveedor',
            'pedidos__servicios_externos__lote',
        ),
        pk=pk,
    )
    return Response({
        'ok': True,
        'data': EntregaDetailV1Serializer(entrega).data,
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def entrega_confirmar(request, pk):
    entrega = get_object_or_404(Entrega, pk=pk)
    serializer = ConfirmarEntregaSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'ok': False, 'error': _primer_error_serializer(serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data

    try:
        resultado = ServicioPedido.confirmar_entrega(
            entrega,
            monto_cup=datos.get('monto_cup') or Decimal('0'),
            monto_usd=datos.get('monto_usd') or Decimal('0'),
            tasa_aplicada=datos.get('tasa_aplicada'),
            metodo=datos.get('metodo') or 'EFECTIVO',
            usuario=request.user.username,
            notas=datos.get('notas') or '',
        )
    except (ValueError, Estado.DoesNotExist) as error:
        return Response(
            {'ok': False, 'error': str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    entrega = (
        Entrega.objects.select_related('cliente').prefetch_related(
            'pedidos__libro',
            'pedidos__estado',
            'pedidos__cliente',
            'pedidos__servicios_externos__proveedor',
            'pedidos__servicios_externos__lote',
        ).get(pk=entrega.pk)
    )

    return Response({
        'ok': True,
        'data': {
            'entrega': EntregaDetailV1Serializer(entrega).data,
            'pago': {
                'monto_cup': float(resultado['monto_cup']),
                'monto_usd': float(resultado['monto_usd']),
                'total_cup': float(resultado['total_cup']),
                'aplicado_cup': float(resultado['aplicado_cup']),
                'excedente_cup': float(resultado['excedente_cup']),
                'vuelto_cup': float(resultado['vuelto_cup']),
                'propina_cup': float(resultado['propina_cup']),
                'tasa': (
                    float(resultado['tasa'])
                    if resultado['tasa'] is not None
                    else None
                ),
                'saldo_pedidos': float(resultado['saldo_pedidos']),
                'costo_mensajeria': float(resultado['costo_mensajeria']),
                'total_a_cobrar': float(resultado['total_a_cobrar']),
            },
            'movimientos': AnticipoV1Serializer(
                resultado['movimientos'],
                many=True,
            ).data,
        },
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def entrega_crear(request):
    serializer = CrearEntregaSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'ok': False, 'error': _primer_error_serializer(serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data
    pedidos = list(
        Pedido.objects.filter(id__in=datos['pedido_ids'])
        .select_related('cliente', 'estado')
    )

    if len(pedidos) != len(datos['pedido_ids']):
        return Response(
            {'ok': False, 'error': 'Algunos pedidos no existen.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Pedido.objects.filter(
        id__in=datos['pedido_ids'],
        entregas__isnull=False,
    ).exists():
        return Response(
            {
                'ok': False,
                'error': 'Algunos pedidos ya pertenecen a otra entrega.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if any(
        pedido.estado is None
        or pedido.estado.nombre != 'Listo para Entregar'
        for pedido in pedidos
    ):
        return Response(
            {
                'ok': False,
                'error': 'Solo se pueden entregar pedidos en estado '
                '"Listo para Entregar".',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    clientes = {pedido.cliente_id for pedido in pedidos if pedido.cliente_id}
    if len(clientes) > 1:
        return Response(
            {
                'ok': False,
                'error': 'Todos los pedidos deben ser del mismo cliente.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not clientes:
        return Response(
            {
                'ok': False,
                'error': 'Los pedidos deben tener un cliente asignado.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    cliente = next((pedido.cliente for pedido in pedidos if pedido.cliente_id), None)
    direccion = (datos.get('direccion') or '').strip()
    if not direccion:
        direccion = (cliente.direccion or '').strip()
    if not direccion:
        return Response(
            {
                'ok': False,
                'error': (
                    'El cliente no tiene dirección registrada. '
                    'Indica una dirección de entrega.'
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        entrega = Entrega.objects.create(
            cliente=cliente,
            direccion=direccion,
            costo_mensajeria=datos.get('costo_mensajeria') or Decimal('0'),
            fecha_entrega=datos.get('fecha_entrega'),
            notas=datos.get('notas') or '',
        )
        entrega.pedidos.set(pedidos)

    entrega = (
        Entrega.objects.select_related('cliente').prefetch_related(
            'pedidos__libro',
            'pedidos__estado',
            'pedidos__cliente',
            'pedidos__servicios_externos__proveedor',
            'pedidos__servicios_externos__lote',
        ).get(pk=entrega.pk)
    )

    return Response(
        {
            'ok': True,
            'data': EntregaDetailV1Serializer(entrega).data,
        },
        status=status.HTTP_201_CREATED,
    )


class PedidoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'per_page'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'ok': True,
            'data': data,
            'pagination': {
                'count': self.page.paginator.count,
                'page': self.page.number,
                'num_pages': self.page.paginator.num_pages,
                'per_page': self.page.paginator.per_page,
                'start_index': self.page.start_index(),
                'end_index': self.page.end_index(),
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            },
        })


class PedidoViewSetV1(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = PedidoPagination
    queryset = Pedido.objects.select_related('cliente', 'libro', 'estado').all()

    def get_serializer_class(self):
        if self.action in ('retrieve', 'cambiar_estado', 'registrar_anticipo'):
            return PedidoDetailV1Serializer
        return PedidoListV1Serializer

    def get_queryset(self):
        queryset = super().get_queryset()

        if _es_verdadero(self.request.query_params.get('en_taller', '')):
            queryset = queryset.exclude(
                Q(estado__es_final=True)
                | Q(estado__activo=False)
                | Q(estado__nombre__in=ESTADOS_NO_TALLER)
            )

        search = self.request.query_params.get('search', '').strip()
        if search:
            filtros = (
                Q(cliente__nombre__icontains=search)
                | Q(libro__titulo__icontains=search)
                | Q(libro__autor__icontains=search)
                | Q(estado__nombre__icontains=search)
            )
            if search.isdigit():
                filtros |= Q(id=int(search)) | Q(referencia_externa=int(search))
            queryset = queryset.filter(filtros)

        estado = self.request.query_params.get('estado', '').strip()
        if estado:
            if estado.isdigit():
                queryset = queryset.filter(estado_id=int(estado))
            else:
                queryset = queryset.filter(estado__nombre=estado)

        return queryset.order_by(
            F('referencia_externa').asc(nulls_last=True),
            'id',
        )

    def create(self, request, *args, **kwargs):
        serializer = PedidoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            cliente = None
            if data.get('cliente_id'):
                cliente = Cliente.objects.get(pk=data['cliente_id'])
            else:
                cliente = Cliente.objects.create(
                    nombre=data.get('cliente_nombre') or '',
                    telefono=data.get('cliente_telefono') or '',
                    direccion=data.get('cliente_direccion') or '',
                )

            libro = None
            if data.get('libro_id'):
                libro = Book.objects.get(pk=data['libro_id'])
            else:
                libro = Book.objects.create(
                    titulo=data.get('libro_titulo') or '',
                    autor=data.get('libro_autor') or '',
                    paginas=int(data.get('libro_paginas') or 0),
                    precio=Decimal(str(data.get('precio_venta') or 0)),
                )

            cod_obj = None
            descuento = Decimal(str(data.get('descuento_aplicado') or 0))
            codigo_str = str(data.get('codigo_descuento') or '').strip().upper()
            if codigo_str:
                cod_obj = CodigoDescuento.objects.get(codigo__iexact=codigo_str)
                if not cod_obj.vigente:
                    return Response(
                        {'ok': False, 'error': 'El código está expirado o inactivo.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not cod_obj.aplica_a_libro(libro):
                    return Response(
                        {'ok': False, 'error': 'El código no aplica a este libro.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            siguiente_ref = _siguiente_referencia()
            estado_inicial = Estado.objects.get(nombre='Pendiente a impresión')
            anticipo = Decimal(str(data.get('anticipo_requerido') or 0))
            monto_anticipo = Decimal(str(data.get('monto_anticipo') or 0))
            moneda_anticipo = data.get('moneda_anticipo') or 'CUP'
            tasa_anticipo = data.get('tasa_cambio')
            pedido = Pedido.objects.create(
                cliente=cliente,
                libro=libro,
                cantidad=int(data.get('cantidad') or 1),
                lleva_scotch=bool(data.get('lleva_scotch')),
                lleva_esquineros=bool(data.get('lleva_esquineros')),
                precio_venta=Decimal(str(data.get('precio_venta') or 0)),
                descuento_aplicado=descuento,
                codigo_descuento=cod_obj,
                anticipo_requerido=anticipo,
                estado=estado_inicial,
                notas=data.get('notas') or '',
                referencia_externa=siguiente_ref,
            )
            pedido.calcular_fecha_entrega()

            if cod_obj:
                cod_obj.usos_actuales += 1
                cod_obj.save(update_fields=['usos_actuales'])

            if monto_anticipo > 0:
                ServicioFinanzas.registrar_pago_mixto(
                    pedido,
                    monto_cup=(
                        Decimal('0')
                        if moneda_anticipo == 'USD'
                        else monto_anticipo
                    ),
                    monto_usd=(
                        monto_anticipo
                        if moneda_anticipo == 'USD'
                        else Decimal('0')
                    ),
                    tasa_aplicada=tasa_anticipo,
                    metodo='EFECTIVO',
                    categoria='ANTICIPO_CLIENTE',
                    permitir_vuelto=True,
                )

        pedido = (
            Pedido.objects.select_related('cliente', 'libro', 'estado')
            .get(pk=pedido.pk)
        )
        return Response(
            {
                'ok': True,
                'data': {'pedido': PedidoDetailV1Serializer(pedido).data},
            },
            status=status.HTTP_201_CREATED,
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({'ok': True, 'data': serializer.data})

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({'ok': True, 'data': serializer.data})

    @action(detail=False, methods=['get'], url_path='parametros-costo')
    def parametros_costo(self, request):
        return Response({'ok': True, 'data': {'parametros': _parametros_costo()}})

    @action(detail=False, methods=['get'], url_path='calcular-costo')
    def calcular_costo(self, request):
        try:
            paginas = int(request.query_params.get('paginas') or 0)
            lleva_scotch = _es_verdadero(request.query_params.get('lleva_scotch') or '')
            lleva_esquineros = _es_verdadero(
                request.query_params.get('lleva_esquineros') or ''
            )

            if paginas <= 0:
                return Response(
                    {'ok': False, 'error': 'Páginas inválidas'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            resultado = _calcular_costo_paginas(
                paginas,
                lleva_scotch=lleva_scotch,
                lleva_esquineros=lleva_esquineros,
            )

            return Response({'ok': True, 'data': {'costo': resultado}})
        except Exception as error:
            return Response(
                {'ok': False, 'error': str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['get'], url_path='codigos-vigentes')
    def codigos_vigentes(self, request):
        hoy = timezone.now().date()
        codigos = CodigoDescuento.objects.filter(
            activo=True,
        ).filter(
            Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=hoy),
        ).filter(
            Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy),
        ).filter(
            Q(usos_maximos__isnull=True) | Q(usos_actuales__lt=F('usos_maximos')),
        ).order_by('codigo')

        data = [
            {
                'id': codigo.id,
                'codigo': codigo.codigo,
                'descripcion': codigo.descripcion,
                'porcentaje': float(codigo.porcentaje),
                'categoria': codigo.categoria,
            }
            for codigo in codigos
        ]
        return Response({'ok': True, 'data': {'codigos': data}})

    @action(detail=False, methods=['get'], url_path='validar-descuento')
    def validar_descuento(self, request):
        codigo = str(request.query_params.get('codigo') or '').strip().upper()
        precio = Decimal(str(request.query_params.get('precio') or 0))
        libro_id = request.query_params.get('libro_id')

        if not codigo:
            return Response(
                {'ok': False, 'error': 'Ingresa un código'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            codigo_descuento = CodigoDescuento.objects.get(codigo__iexact=codigo)
        except CodigoDescuento.DoesNotExist:
            return Response(
                {'ok': False, 'error': 'Código no válido'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not codigo_descuento.vigente:
            return Response(
                {'ok': False, 'error': 'Código expirado o inactivo'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        libro = None
        if libro_id:
            try:
                libro = Book.objects.get(id=libro_id)
            except Book.DoesNotExist:
                return Response(
                    {'ok': False, 'error': 'El libro no existe'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if libro and not codigo_descuento.aplica_a_libro(libro):
                return Response(
                    {'ok': False, 'error': 'El código no aplica a este libro'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        descuento = precio * (codigo_descuento.porcentaje / Decimal('100'))
        precio_final = precio - descuento
        return Response({
            'ok': True,
            'data': {
                'porcentaje': float(codigo_descuento.porcentaje),
                'descuento': float(descuento),
                'precio_final': float(precio_final),
                'descripcion': codigo_descuento.descripcion,
            },
        })

    @action(detail=False, methods=['get'], url_path='estados')
    def estados(self, request):
        estados = Estado.objects.all().order_by('orden', 'nombre')
        return Response({
            'ok': True,
            'data': EstadoV1Serializer(estados, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        pedido = self.get_object()
        serializer = CambiarEstadoSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {'ok': False, 'error': _primer_error_serializer(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        datos = serializer.validated_data

        try:
            with transaction.atomic():
                if datos['estado'] == 'Entregado':
                    monto_cup = datos.get('monto_cup') or Decimal('0')
                    monto_usd = datos.get('monto_usd') or Decimal('0')
                    if monto_cup > 0 or monto_usd > 0:
                        ServicioFinanzas.registrar_pago_mixto(
                            pedido,
                            monto_cup=monto_cup,
                            monto_usd=monto_usd,
                            tasa_aplicada=datos.get('tasa_aplicada'),
                            metodo=datos.get('metodo') or 'EFECTIVO',
                            categoria='SALDO_CLIENTE',
                            permitir_vuelto=True,
                            exigir_saldo_exacto=True,
                        )

                ServicioPedido.cambiar_estado(
                    pedido,
                    datos['estado'],
                    usuario=request.user.username,
                    notas=datos.get('notas', ''),
                )
        except Estado.DoesNotExist:
            return Response(
                {'ok': False, 'error': 'El estado indicado no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as error:
            return Response(
                {'ok': False, 'error': str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedido.refresh_from_db()
        return Response({
            'ok': True,
            'data': self.get_serializer(pedido).data,
        })

    @action(detail=False, methods=['post'], url_path='cambiar-estado-masivo')
    def cambiar_estado_masivo(self, request):
        serializer = CambiarEstadoMasivoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        nuevo_estado = Estado.objects.filter(pk=datos['estado_id']).first()
        if not nuevo_estado:
            return Response(
                {'ok': False, 'error': 'El estado indicado no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedidos = list(
            Pedido.objects.filter(id__in=datos['pedido_ids'])
            .select_related('estado')
            .order_by('id')
        )
        encontrados = {pedido.id for pedido in pedidos}
        errores = [
            f'Pedido {pedido_id}: no encontrado.'
            for pedido_id in datos['pedido_ids']
            if pedido_id not in encontrados
        ]
        actualizados = 0

        for pedido in pedidos:
            if pedido.estado_id == nuevo_estado.id:
                continue

            try:
                ServicioPedido.cambiar_estado(
                    pedido,
                    nuevo_estado.nombre,
                    usuario=request.user.username,
                    notas=datos.get('notas') or 'Cambio masivo',
                )
                actualizados += 1
            except Exception as error:
                errores.append(f'Pedido {pedido.id}: {error}')

        return Response({
            'ok': True,
            'data': {
                'actualizados': actualizados,
                'estado': {
                    'id': nuevo_estado.id,
                    'nombre': nuevo_estado.nombre,
                },
                'errores': errores,
            },
        })

    @action(detail=False, methods=['get'], url_path='tasa-cambio')
    def tasa_cambio_actual(self, request):
        tasa = ServicioFinanzas.obtener_tasa_usd_cup()
        return Response({
            'ok': True,
            'data': {
                'tasa_cambio': float(tasa),
                'moneda_base': 'CUP',
                'moneda_extranjera': 'USD',
            },
        })

    @action(detail=True, methods=['post'], url_path='registrar-anticipo')
    def registrar_anticipo(self, request, pk=None):
        pedido = self.get_object()
        serializer = RegistrarAnticipoSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {'ok': False, 'error': _primer_error_serializer(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        datos = serializer.validated_data

        try:
            with transaction.atomic():
                resultado = ServicioFinanzas.registrar_pago_mixto(
                    pedido,
                    monto_cup=datos.get('monto_cup') or Decimal('0'),
                    monto_usd=datos.get('monto_usd') or Decimal('0'),
                    tasa_aplicada=datos.get('tasa_aplicada'),
                    metodo=datos.get('metodo') or 'EFECTIVO',
                    categoria='ANTICIPO_CLIENTE',
                    permitir_vuelto=True,
                )
        except ValueError as error:
            return Response(
                {'ok': False, 'error': str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        movimiento = resultado['movimiento']
        pedido.refresh_from_db()
        return Response({
            'ok': True,
            'data': {
                'pedido': self.get_serializer(pedido).data,
                'movimiento_id': movimiento.id if movimiento else None,
                'total_cup': float(resultado['total_cup']),
                'vuelto_cup': float(resultado['vuelto_cup']),
            },
        }, status=status.HTTP_201_CREATED)






class ClienteViewSetV1(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ClienteListV1Serializer
    http_method_names = ['get', 'post', 'head', 'options']

    ESTADOS_EXCLUIDOS = ('Entregado', 'Cancelado')

    def get_queryset(self):
        return Cliente.objects.annotate(
            pedidos_totales=Count(
                'pedidos',
                distinct=True,
                filter=~Q(pedidos__estado__nombre__in=self.ESTADOS_EXCLUIDOS),
            ),
            saldo_pendiente_total_db=Sum(
                'pedidos__saldo_pendiente',
                filter=~Q(pedidos__estado__nombre__in=self.ESTADOS_EXCLUIDOS),
            ),
        ).order_by('nombre')

    def _filtrar(self, queryset, request):
        nombre = request.query_params.get('nombre', '').strip()
        telefono = request.query_params.get('telefono', '').strip()
        deuda = request.query_params.get('deuda', '')
        orden = request.query_params.get('orden', 'nombre_asc')
        search = request.query_params.get('search', '').strip()

        if nombre:
            queryset = queryset.filter(nombre__icontains=nombre)
        if telefono:
            queryset = queryset.filter(telefono__icontains=telefono)
        if deuda == 'con_deuda':
            queryset = queryset.filter(saldo_pendiente_total_db__gt=0)
        elif deuda == 'al_dia':
            queryset = queryset.filter(saldo_pendiente_total_db=0)
        if search:
            queryset = queryset.filter(nombre__icontains=search)

        if orden == 'nombre_desc':
            return queryset.order_by('-nombre')
        if orden == 'pedidos_desc':
            return queryset.order_by('-pedidos_totales', '-nombre')
        if orden == 'pedidos_asc':
            return queryset.order_by('pedidos_totales', 'nombre')
        return queryset.order_by('nombre')

    def _per_page(self, request):
        try:
            valor = int(request.query_params.get('per_page') or 10)
        except (TypeError, ValueError):
            valor = 10
        return valor if 1 <= valor <= 500 else 10

    def list(self, request, *args, **kwargs):
        queryset = self._filtrar(self.get_queryset(), request)
        paginator = Paginator(queryset, self._per_page(request))
        page_obj = paginator.get_page(request.query_params.get('page') or 1)
        clientes = ClienteListV1Serializer(page_obj.object_list, many=True).data

        return Response({
            'ok': True,
            'data': {'clientes': clientes},
            'pagination': payload_paginacion(paginator, page_obj),
            'meta': {
                'total_clientes': paginator.count,
                'filtros': {
                    'nombre': request.query_params.get('nombre', ''),
                    'telefono': request.query_params.get('telefono', ''),
                    'deuda': request.query_params.get('deuda', ''),
                },
            },
        })

    def retrieve(self, request, *args, **kwargs):
        cliente = self.get_object()
        serializer = ClienteDetailV1Serializer(cliente)
        return Response({'ok': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = ClienteCreateV1Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cliente = serializer.save()
        return Response(
            {
                'ok': True,
                'data': ClienteListV1Serializer(cliente).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LibroViewSetV1(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Book.objects.all().order_by('titulo')
    serializer_class = LibroListV1Serializer
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    @action(detail=False, methods=['get'], url_path='parametros-costo')
    def parametros_costo(self, request):
        return Response({'ok': True, 'data': {'parametros': _parametros_costo()}})

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(titulo__icontains=search) | Q(autor__icontains=search)
            )
        serializer = self.get_serializer(queryset, many=True)
        return Response({'ok': True, 'data': serializer.data})

    def retrieve(self, request, *args, **kwargs):
        libro = self.get_object()
        serializer = self.get_serializer(libro)
        return Response({'ok': True, 'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(
            {'ok': True, 'data': serializer.data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        libro = self.get_object()
        serializer = self.get_serializer(
            libro,
            data=request.data,
            partial=partial,
        )
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({'ok': True, 'data': serializer.data})

    def destroy(self, request, *args, **kwargs):
        libro = self.get_object()
        libro.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _proveedores_queryset():
    return Proveedor.objects.annotate(
        deuda_total_db=Sum(
            'servicioexterno__monto',
            filter=Q(servicioexterno__estado__in=['SOLICITADO', 'RECIBIDO']),
        )
    ).order_by('nombre')


def _lotes_queryset():
    return LoteServicio.objects.select_related('proveedor').prefetch_related(
        'servicios__pedido__libro',
        'servicios__pedido__cliente',
    )


def _pedidos_asociados_lote(lote):
    pedidos = {}

    for servicio in lote.servicios.all():
        pedido = servicio.pedido
        if pedido.id not in pedidos:
            pedidos[pedido.id] = {
                'pedido_id': pedido.id,
                'referencia_externa': pedido.referencia_externa,
                'libro_titulo': pedido.libro.titulo,
                'cantidad': pedido.cantidad,
                'cliente_nombre': (
                    pedido.cliente.nombre
                    if pedido.cliente
                    else 'Stock / Venta Directa'
                ),
                'monto': 0.0,
                'servicios': 0,
            }
        pedidos[pedido.id]['monto'] += float(servicio.monto)
        pedidos[pedido.id]['servicios'] += 1

    return sorted(pedidos.values(), key=lambda item: item['pedido_id'])


class EmpleadoViewSetV1(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = EmpleadoV1Serializer
    http_method_names = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'head',
        'options',
    ]

    def get_queryset(self):
        queryset = Empleado.objects.prefetch_related('pagos').order_by(
            'nombre', 'id'
        )
        search = self.request.query_params.get('search', '').strip()
        activo = self.request.query_params.get('activo', '')

        if search:
            queryset = queryset.filter(
                Q(nombre__icontains=search) | Q(telefono__icontains=search)
            )
        if activo in ('1', 'true'):
            queryset = queryset.filter(activo=True)
        elif activo in ('0', 'false'):
            queryset = queryset.filter(activo=False)

        return queryset

    def _per_page(self):
        try:
            valor = int(self.request.query_params.get('per_page') or 10)
        except (TypeError, ValueError):
            valor = 10
        return valor if 1 <= valor <= 500 else 10

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self._per_page())
        page_obj = paginator.get_page(request.query_params.get('page') or 1)
        empleados = EmpleadoV1Serializer(
            page_obj.object_list,
            many=True,
        ).data

        return Response({
            'ok': True,
            'data': {'empleados': empleados},
            'pagination': payload_paginacion(paginator, page_obj),
            'meta': {'total_empleados': paginator.count},
        })

    def retrieve(self, request, *args, **kwargs):
        empleado = self.get_object()
        return Response({
            'ok': True,
            'data': EmpleadoV1Serializer(empleado).data,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        empleado = serializer.save()
        return Response(
            {
                'ok': True,
                'data': EmpleadoV1Serializer(empleado).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        empleado = self.get_object()
        serializer = self.get_serializer(
            empleado,
            data=request.data,
            partial=partial,
        )
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        empleado = serializer.save()
        return Response({
            'ok': True,
            'data': EmpleadoV1Serializer(empleado).data,
        })

    def destroy(self, request, *args, **kwargs):
        empleado = self.get_object()
        try:
            empleado.delete()
        except ProtectedError:
            return Response(
                {
                    'ok': False,
                    'error': (
                        'No se puede eliminar el empleado porque tiene '
                        'pagos registrados.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='utilidades-disponibles')
    def utilidades_disponibles(self, request):
        disponible = ServicioFinanzas.calcular_utilidades_disponibles()
        data = {
            'disponible_cup': float(disponible['disponible_cup']),
            'disponible_usd': float(disponible['disponible_usd']),
            'tasa_actual': float(disponible['tasa_actual']),
            'saldo_cup': float(disponible['saldo_cup']),
            'saldo_usd': float(disponible['saldo_usd']),
            'anticipos': float(disponible['anticipos']),
            'deudas': float(disponible['deudas']),
            'pasivos': float(disponible['pasivos']),
            'mensaje': disponible['mensaje'],
            'fecha_calculo': disponible['fecha_calculo'].isoformat(),
        }
        return Response({'ok': True, 'data': data})

    @action(detail=True, methods=['post'], url_path='pagar')
    def pagar(self, request, pk=None):
        empleado = self.get_object()
        serializer = PagarEmpleadoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        datos = serializer.validated_data
        monto = datos['monto']
        moneda = datos['moneda']
        tipo = datos.get('concepto', 'SALARIO')

        if tipo == 'UTILIDADES':
            disponible = ServicioFinanzas.calcular_utilidades_disponibles()
            limite = (
                disponible['disponible_cup']
                if moneda == 'CUP'
                else disponible['disponible_usd']
            )
            if monto > limite:
                return Response(
                    {
                        'ok': False,
                        'error': (
                            'No hay suficientes utilidades disponibles en '
                            f'{moneda}. Disponible: {limite} {moneda}.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        categoria = (
            'RETIRO_UTILIDADES' if tipo == 'UTILIDADES' else 'PAGO_NOMINA'
        )
        etiqueta = (
            'Retiro de utilidades' if tipo == 'UTILIDADES' else 'Pago de salario'
        )
        mes = datos.get('mes_correspondiente') or _mes_actual_texto()
        concepto_caja = f'{etiqueta} - {empleado.nombre}'
        if moneda == 'USD' and datos.get('tasa'):
            concepto_caja += f' (tasa {datos["tasa"]} CUP/USD)'

        with transaction.atomic():
            pago = PagoNomina.objects.create(
                empleado=empleado,
                tipo=tipo,
                fecha=timezone.localdate(),
                mes_correspondiente=mes,
                monto_pagado=monto,
                moneda=moneda,
                tasa_aplicada=datos.get('tasa'),
                notas=datos.get('notas', ''),
            )
            movimiento = MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria=categoria,
                monto=monto,
                moneda=moneda,
                metodo=datos.get('metodo', 'EFECTIVO'),
                concepto=concepto_caja,
            )

        return Response(
            {
                'ok': True,
                'data': {
                    'pago': PagoNominaV1Serializer(pago).data,
                    'movimiento': MovimientoCajaV1Serializer(movimiento).data,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ProveedorViewSetV1(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProveedorV1Serializer
    http_method_names = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'head',
        'options',
    ]

    def get_queryset(self):
        queryset = _proveedores_queryset()
        search = self.request.query_params.get('search', '').strip()
        activo = self.request.query_params.get('activo', '')

        if search:
            queryset = queryset.filter(
                Q(nombre__icontains=search) | Q(telefono__icontains=search)
            )
        if activo in ('1', 'true'):
            queryset = queryset.filter(activo=True)
        elif activo in ('0', 'false'):
            queryset = queryset.filter(activo=False)

        return queryset

    def _per_page(self):
        try:
            valor = int(self.request.query_params.get('per_page') or 10)
        except (TypeError, ValueError):
            valor = 10
        return valor if 1 <= valor <= 500 else 10

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self._per_page())
        page_obj = paginator.get_page(request.query_params.get('page') or 1)
        proveedores = ProveedorV1Serializer(
            page_obj.object_list,
            many=True,
        ).data

        return Response({
            'ok': True,
            'data': {'proveedores': proveedores},
            'pagination': payload_paginacion(paginator, page_obj),
            'meta': {'total_proveedores': paginator.count},
        })

    def retrieve(self, request, *args, **kwargs):
        proveedor = self.get_object()
        return Response({
            'ok': True,
            'data': ProveedorV1Serializer(proveedor).data,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        proveedor = serializer.save()
        return Response(
            {
                'ok': True,
                'data': ProveedorV1Serializer(proveedor).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        proveedor = self.get_object()
        serializer = self.get_serializer(
            proveedor,
            data=request.data,
            partial=partial,
        )
        if not serializer.is_valid():
            return Response(
                {
                    'ok': False,
                    'error': _primer_error_serializer(serializer.errors),
                    'details': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        proveedor = serializer.save()
        return Response({
            'ok': True,
            'data': ProveedorV1Serializer(proveedor).data,
        })

    def destroy(self, request, *args, **kwargs):
        proveedor = self.get_object()
        try:
            proveedor.delete()
        except ProtectedError:
            return Response(
                {
                    'ok': False,
                    'error': (
                        'No se puede eliminar el proveedor porque tiene '
                        'servicios o lotes asociados.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def proveedor_lotes(request, proveedor_id):
    proveedor = get_object_or_404(
        _proveedores_queryset(),
        pk=proveedor_id,
    )
    lotes = _lotes_queryset().filter(proveedor=proveedor)
    abiertos = lotes.filter(estado__in=['ABIERTO', 'CERRADO'])
    pagados = lotes.filter(estado='PAGADO')

    return Response({
        'ok': True,
        'data': {
            'proveedor': ProveedorV1Serializer(proveedor).data,
            'abiertos': LoteServicioV1Serializer(abiertos, many=True).data,
            'pagados': LoteServicioV1Serializer(pagados, many=True).data,
        },
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def proveedor_lote_pagar(request, lote_id):
    metodo = (request.data.get('metodo') or 'EFECTIVO').strip().upper()
    metodos_validos = dict(MovimientoCaja.METODO_CHOICES)
    if metodo not in metodos_validos:
        return Response(
            {'ok': False, 'error': 'El método de pago no es válido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        monto_cup = Decimal(str(request.data.get('monto_cup') or 0))
        monto_usd = Decimal(str(request.data.get('monto_usd') or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Response(
            {'ok': False, 'error': 'Los montos del pago no son válidos.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        lote = get_object_or_404(
            LoteServicio.objects.select_for_update().select_related('proveedor'),
            pk=lote_id,
        )

        if lote.estado == 'PAGADO':
            return Response(
                {'ok': False, 'error': 'Este lote ya está pagado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if lote.estado == 'CANCELADO':
            return Response(
                {'ok': False, 'error': 'No se puede pagar un lote cancelado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        servicios = list(
            lote.servicios.filter(
                estado__in=['SOLICITADO', 'RECIBIDO']
            ).select_related('pedido')
        )
        if not servicios:
            return Response(
                {
                    'ok': False,
                    'error': 'El lote no tiene servicios pendientes de pago.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_pendiente = sum(
            (servicio.monto for servicio in servicios),
            Decimal('0'),
        )

        if monto_cup > 0 or monto_usd > 0:
            try:
                _, _, total_recibido_cup, tasa_aplicada = (
                    ServicioFinanzas.normalizar_pago_mixto(
                        monto_cup=monto_cup,
                        monto_usd=monto_usd,
                        tasa_aplicada=request.data.get('tasa_aplicada'),
                    )
                )
            except ValueError as error:
                return Response(
                    {'ok': False, 'error': str(error)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if total_recibido_cup + Decimal('0.005') < total_pendiente:
                faltante = total_pendiente - total_recibido_cup
                return Response(
                    {
                        'ok': False,
                        'error': (
                            f'Faltan ${faltante:.2f} CUP para pagar el lote.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            vuelto_cup = max(
                Decimal('0'),
                total_recibido_cup - total_pendiente,
            )
        else:
            total_recibido_cup = total_pendiente
            vuelto_cup = Decimal('0')
            tasa_aplicada = None

        ahora = timezone.now()
        movimientos = []

        for servicio in servicios:
            movimiento = MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='PAGO_PROVEEDOR',
                monto=servicio.monto,
                metodo=metodo,
                moneda='CUP',
                concepto=(
                    f'Pago {servicio.get_tipo_display()} - '
                    f'Pedido #{servicio.pedido_id} ({lote.numero})'
                )[:200],
                proveedor=lote.proveedor,
                pedido=servicio.pedido,
            )
            movimientos.append(movimiento)

            servicio.estado = 'PAGADO'
            servicio.fecha_pago = ahora
            if not servicio.fecha_recepcion:
                servicio.fecha_recepcion = ahora
            servicio.save(
                update_fields=[
                    'estado',
                    'fecha_pago',
                    'fecha_recepcion',
                ]
            )

        lote.estado = 'PAGADO'
        lote.fecha_pago = ahora
        if not lote.fecha_cierre:
            lote.fecha_cierre = ahora
        lote.save(update_fields=['estado', 'fecha_pago', 'fecha_cierre'])

        lote_actualizado = _lotes_queryset().get(pk=lote.pk)
        movimientos_data = MovimientoCajaV1Serializer(
            movimientos,
            many=True,
        ).data

        return Response({
            'ok': True,
            'data': {
                'lote': LoteServicioV1Serializer(lote_actualizado).data,
                'movimiento': (
                    movimientos_data[0]
                    if len(movimientos_data) == 1
                    else None
                ),
                'movimientos': movimientos_data,
                'total_pagado': float(total_pendiente),
                'total_recibido_cup': float(total_recibido_cup),
                'vuelto_cup': float(vuelto_cup),
                'tasa_aplicada': (
                    float(tasa_aplicada)
                    if tasa_aplicada is not None
                    else None
                ),
            },
        })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def proveedor_lote_orden(request, lote_id):
    lote = get_object_or_404(_lotes_queryset(), pk=lote_id)

    return Response({
        'ok': True,
        'data': {
            'lote': LoteServicioV1Serializer(lote).data,
            'proveedor': ProveedorV1Serializer(lote.proveedor).data,
            'pedidos': _pedidos_asociados_lote(lote),
        },
    })


def _caja_queryset(request):
    queryset = MovimientoCaja.objects.select_related(
        'pedido',
        'proveedor',
        'cliente',
    )
    desde = parse_fecha(request.query_params.get('desde'))
    hasta = parse_fecha(request.query_params.get('hasta'))
    if desde and hasta and desde > hasta:
        desde, hasta = hasta, desde
    if desde:
        queryset = queryset.filter(fecha__date__gte=desde)
    if hasta:
        queryset = queryset.filter(fecha__date__lte=hasta)

    categoria = (request.query_params.get('categoria') or '').strip()
    if categoria:
        queryset = queryset.filter(categoria=categoria)

    tipo = (request.query_params.get('tipo') or '').strip().upper()
    if tipo in ('INGRESO', 'EGRESO'):
        queryset = queryset.filter(tipo=tipo)

    moneda = (request.query_params.get('moneda') or '').strip().upper()
    if moneda in ('CUP', 'USD'):
        queryset = queryset.filter(moneda=moneda)

    return queryset.order_by('-fecha', '-id')


def _per_page_caja(request):
    try:
        valor = int(request.query_params.get('per_page') or 10)
    except (TypeError, ValueError):
        valor = 10
    return valor if 1 <= valor <= 500 else 10


def _paginacion_caja(paginator, page_obj):
    pagination = payload_paginacion(paginator, page_obj)
    pagination['count'] = pagination['total']
    return pagination


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_caja(request):
    queryset = _caja_queryset(request)
    paginator = Paginator(queryset, _per_page_caja(request))
    page_obj = paginator.get_page(request.query_params.get('page') or 1)
    movimientos = MovimientoCajaV1Serializer(
        page_obj.object_list,
        many=True,
    ).data

    return Response({
        'ok': True,
        'data': {'movimientos': movimientos},
        'pagination': _paginacion_caja(paginator, page_obj),
        'meta': {
            'categorias': [
                {'value': value, 'label': label}
                for value, label in MovimientoCaja.CATEGORIA_CHOICES
            ],
        },
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_caja_resumen(request):
    movimientos = _caja_queryset(request)
    ingresos_brutos = (
        movimientos.filter(tipo='INGRESO')
        .exclude(Q_NO_INGRESO_OPERATIVO)
        .aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )
    vueltos = (
        movimientos.filter(
            tipo='EGRESO',
            categoria=CATEGORIA_VUELTO_CLIENTE,
        ).aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )
    total_egresos = (
        movimientos.filter(tipo='EGRESO')
        .exclude(Q_NO_EGRESO_OPERATIVO)
        .aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )

    return Response({
        'ok': True,
        'data': {
            'total_ingresos': float(ingresos_brutos - vueltos),
            'total_egresos': float(total_egresos),
            'saldo_actual_cup': float(ServicioFinanzas.saldo_caja('CUP')),
            'saldo_actual_usd': float(ServicioFinanzas.saldo_caja('USD')),
            'tasa_usd': float(ServicioFinanzas.obtener_tasa_usd_cup()),
            'depreciacion_activos_mensual': float(
                depreciacion_activos_mensual()
            ),
        },
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_activos(request):
    queryset = ActivoFijo.objects.all().order_by('-fecha_compra', '-id')
    estado = request.query_params.get('estado', '').strip().lower()
    if estado == 'activos':
        queryset = queryset.filter(activo=True)
    elif estado == 'inactivos':
        queryset = queryset.filter(activo=False)

    activos = list(queryset)
    resumen = {
        'cantidad': len(activos),
        'cantidad_activos': sum(1 for activo in activos if activo.activo),
        'total_valor_compra': float(
            sum((activo.valor_compra for activo in activos), Decimal('0'))
        ),
        'total_depreciacion_mensual': float(
            sum(
                (activo.depreciacion_mensual for activo in activos),
                Decimal('0'),
            )
        ),
        'total_depreciacion_acumulada': float(
            sum(
                (
                    activo.depreciacion_acumulada_calculada
                    for activo in activos
                ),
                Decimal('0'),
            )
        ),
        'total_valor_en_libros': float(
            sum((activo.valor_en_libros for activo in activos), Decimal('0'))
        ),
    }

    return Response({
        'ok': True,
        'data': {
            'activos': ActivoFijoV1Serializer(activos, many=True).data,
            'resumen': resumen,
        },
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_activo_detalle(request, pk):
    activo = get_object_or_404(ActivoFijo, pk=pk)
    return Response({
        'ok': True,
        'data': ActivoFijoV1Serializer(activo).data,
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_caja_movimiento(request):
    serializer = RegistrarMovimientoCajaSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'error': _primer_error_serializer(serializer.errors),
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data
    with transaction.atomic():
        movimiento = MovimientoCaja.objects.create(
            tipo=datos['tipo'],
            categoria=datos['categoria'],
            monto=datos['monto'],
            moneda=datos.get('moneda', 'CUP'),
            metodo=datos.get('metodo', 'EFECTIVO'),
            concepto=datos['concepto'],
        )
        if (
            datos['tipo'] == 'EGRESO'
            and datos['categoria'] == 'GASTO_OPERATIVO'
            and datos.get('moneda', 'CUP') == 'CUP'
        ):
            hoy = timezone.localdate()
            GastoOperativo.objects.create(
                concepto=datos['concepto'],
                monto=datos['monto'],
                fecha=hoy,
                mes_imputacion=hoy.replace(day=1),
            )

    return Response(
        {
            'ok': True,
            'data': {
                'movimiento': MovimientoCajaV1Serializer(movimiento).data,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_arqueo(request):
    serializer = RegistrarArqueoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'error': _primer_error_serializer(serializer.errors),
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data
    efectivo_cup = datos['efectivo_cup'].quantize(
        Decimal('0.01'),
        rounding=ROUND_HALF_UP,
    )
    transferencias = datos['transferencias'].quantize(
        Decimal('0.01'),
        rounding=ROUND_HALF_UP,
    )
    total_real_cup = (efectivo_cup + transferencias).quantize(
        Decimal('0.01'),
        rounding=ROUND_HALF_UP,
    )
    esperado_cup = Decimal(
        str(ServicioFinanzas.saldo_caja('CUP'))
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    esperado_usd = Decimal(
        str(ServicioFinanzas.saldo_caja('USD'))
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    diferencia_cup = (total_real_cup - esperado_cup).quantize(
        Decimal('0.01'),
        rounding=ROUND_HALF_UP,
    )

    efectivo_usd_dato = datos.get('efectivo_usd')
    incluye_usd = efectivo_usd_dato is not None
    if incluye_usd:
        efectivo_usd = efectivo_usd_dato.quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
        diferencia_usd = (efectivo_usd - esperado_usd).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
    else:
        efectivo_usd = esperado_usd
        diferencia_usd = Decimal('0.00')

    with transaction.atomic():
        cierre = CierreCaja.objects.create(
            usuario=(request.user.get_username() or '')[:100],
            saldo_sistema=esperado_cup,
            efectivo_real=total_real_cup,
            diferencia=diferencia_cup,
            transferencia=transferencias,
            saldo_sistema_usd=esperado_usd,
            efectivo_real_usd=efectivo_usd,
            diferencia_usd=diferencia_usd,
            notas=datos.get('notas', ''),
        )

        ajustes = []
        monedas_ajuste = [('CUP', diferencia_cup)]
        if incluye_usd:
            monedas_ajuste.append(('USD', diferencia_usd))

        for moneda, diferencia in monedas_ajuste:
            if diferencia == 0:
                continue
            es_sobrante = diferencia > 0
            concepto = (
                f'Ajuste por arqueo #{cierre.id} - '
                f'{"Sobrante" if es_sobrante else "Faltante"} {moneda}'
            )
            ajustes.append(
                MovimientoCaja.objects.create(
                    tipo='INGRESO' if es_sobrante else 'EGRESO',
                    categoria=(
                        'AJUSTE_SOBRANTE'
                        if es_sobrante
                        else 'AJUSTE_FALTANTE'
                    ),
                    monto=abs(diferencia),
                    moneda=moneda,
                    metodo='EFECTIVO',
                    concepto=concepto,
                )
            )

    return Response(
        {
            'ok': True,
            'data': {
                'arqueo': CierreCajaV1Serializer(cierre).data,
                'ajustes': MovimientoCajaV1Serializer(
                    ajustes,
                    many=True,
                ).data,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_arqueos(request):
    queryset = CierreCaja.objects.all().order_by('-fecha', '-id')
    paginator = Paginator(queryset, _per_page_caja(request))
    page_obj = paginator.get_page(request.query_params.get('page') or 1)
    arqueos = CierreCajaV1Serializer(page_obj.object_list, many=True).data

    return Response({
        'ok': True,
        'data': {'arqueos': arqueos},
        'pagination': _paginacion_caja(paginator, page_obj),
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_arqueo_detalle(request, pk):
    cierre = get_object_or_404(CierreCaja, pk=pk)
    return Response({
        'ok': True,
        'data': CierreCajaV1Serializer(cierre).data,
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_divisas_compra(request):
    serializer = RegistrarCompraDivisaSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'error': _primer_error_serializer(serializer.errors),
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data
    try:
        lote = ServicioFinanzas.comprar_divisa(
            monto_usd=datos['monto_usd'],
            tasa_cambio=datos['tasa_cambio'],
        )
    except ValueError as error:
        return Response(
            {'ok': False, 'error': str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            'ok': True,
            'data': {
                'operacion': 'COMPRA_DIVISA',
                'monto_usd': float(datos['monto_usd']),
                'tasa_cambio': float(datos['tasa_cambio']),
                'monto_total_cup': float(datos['monto_usd'] * datos['tasa_cambio']),
                'lote': {
                    'id': lote.id,
                    'cantidad_disponible': float(lote.cantidad_disponible),
                    'precio_compra': float(lote.precio_compra),
                },
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def finanzas_divisas_venta(request):
    serializer = RegistrarVentaDivisaSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'error': _primer_error_serializer(serializer.errors),
                'details': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    datos = serializer.validated_data
    try:
        ganancia = ServicioFinanzas.vender_divisa(
            monto_usd=datos['monto_usd'],
            tasa_cambio=datos['tasa_cambio'],
        )
    except ValueError as error:
        return Response(
            {'ok': False, 'error': str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            'ok': True,
            'data': {
                'operacion': 'VENTA_DIVISA',
                'monto_usd': float(datos['monto_usd']),
                'tasa_cambio': float(datos['tasa_cambio']),
                'monto_total_cup': float(datos['monto_usd'] * datos['tasa_cambio']),
                'ganancia': float(ganancia),
            },
        },
        status=status.HTTP_201_CREATED,
    )
