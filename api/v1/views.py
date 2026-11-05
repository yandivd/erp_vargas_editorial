from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.api import obtener_dashboard_data
from finanzas.services import ServicioFinanzas
from pedidos.models import Estado, Pedido
from pedidos.services import ServicioPedido

from .serializers import (
    ESTADOS_NO_TALLER,
    CambiarEstadoMasivoSerializer,
    CambiarEstadoSerializer,
    EstadoV1Serializer,
    PedidoDetailV1Serializer,
    PedidoListV1Serializer,
    RegistrarAnticipoSerializer,
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


class PedidoViewSetV1(viewsets.ReadOnlyModelViewSet):
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

        return queryset

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
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        try:
            with transaction.atomic():
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

    @action(detail=True, methods=['post'], url_path='registrar-anticipo')
    def registrar_anticipo(self, request, pk=None):
        pedido = self.get_object()
        serializer = RegistrarAnticipoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        with transaction.atomic():
            movimiento = ServicioFinanzas.registrar_anticipo(
                pedido,
                monto=datos['monto'],
                metodo=datos['metodo'],
            )

        pedido.refresh_from_db()
        return Response({
            'ok': True,
            'data': {
                'pedido': self.get_serializer(pedido).data,
                'movimiento_id': movimiento.id if movimiento else None,
            },
        }, status=status.HTTP_201_CREATED)
