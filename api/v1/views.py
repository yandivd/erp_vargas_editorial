from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Count, Sum, F, IntegerField
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
from core.models import Parametro
from finanzas.services import ServicioFinanzas
from inventario.models import Material
from pedidos.models import Book, CodigoDescuento, Entrega, Estado, Pedido
from pedidos.services import CosteadorPedido, ServicioPedido

from .serializers import (
    ESTADOS_NO_TALLER,
    AnticipoV1Serializer,
    CambiarEstadoMasivoSerializer,
    CambiarEstadoSerializer,
    ClienteListV1Serializer,
    ConfirmarEntregaSerializer,
    CrearEntregaSerializer,
    EntregaDetailV1Serializer,
    EntregaListV1Serializer,
    EstadoV1Serializer,
    LibroListV1Serializer,
    PedidoCreateSerializer,
    PedidoDetailV1Serializer,
    PedidoListV1Serializer,
    RegistrarAnticipoSerializer,
    TiendaPedidoSerializer,
)


def _rol_usuario(user):
    if user.is_superuser:
        return 'admin'
    if user.is_staff:
        return 'staff'
    grupo = user.groups.first()
    return grupo.name if grupo else 'usuario'


def _es_verdadero(value):
    return value.strip().lower() in ('1', 'true', 'yes', 'si', 'sí')


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
        }
        for libro in pagina
    ]

    return paginador.get_paginated_response(data)


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

    with transaction.atomic():
        entrega = Entrega.objects.create(
            cliente=pedidos[0].cliente,
            direccion=datos.get('direccion') or '',
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
        material_esquineros = Material.objects.filter(
            nombre__iexact='esquineros'
        ).first()
        parametros = {
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
        return Response({'ok': True, 'data': {'parametros': parametros}})

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
            anticipo_sugerido = round(precio_sugerido / 2, 2)

            resultado['paginas'] = paginas
            resultado['precio_sugerido'] = float(precio_sugerido)
            resultado['anticipo_sugerido'] = float(anticipo_sugerido)

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






class ClienteViewSetV1(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Cliente.objects.all().order_by('nombre')
    serializer_class = ClienteListV1Serializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(nombre__icontains=search)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'ok': True, 'data': serializer.data})


class LibroViewSetV1(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Book.objects.all().order_by('titulo')
    serializer_class = LibroListV1Serializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(titulo__icontains=search) | Q(autor__icontains=search)
            )
        serializer = self.get_serializer(queryset, many=True)
        return Response({'ok': True, 'data': serializer.data})
