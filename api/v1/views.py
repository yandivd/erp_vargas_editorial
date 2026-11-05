from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.api import obtener_dashboard_data
from finanzas.services import ServicioFinanzas
from pedidos.api import PedidoSerializer
from pedidos.models import Estado, Pedido
from pedidos.services import ServicioPedido

from .serializers import CambiarEstadoSerializer, RegistrarAnticipoSerializer


def _rol_usuario(user):
    if user.is_superuser:
        return 'admin'
    if user.is_staff:
        return 'staff'
    grupo = user.groups.first()
    return grupo.name if grupo else 'usuario'


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


class PedidoViewSetV1(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Pedido.objects.select_related('cliente', 'libro', 'estado').all()
    serializer_class = PedidoSerializer

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
            'data': PedidoSerializer(pedido).data,
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
                'pedido': PedidoSerializer(pedido).data,
                'movimiento_id': movimiento.id if movimiento else None,
            },
        }, status=status.HTTP_201_CREATED)
