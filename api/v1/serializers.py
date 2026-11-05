from decimal import Decimal

from rest_framework import serializers

from finanzas.models import MovimientoCaja
from pedidos.models import Estado, Pedido, ServicioExterno


ESTADOS_NO_TALLER = ('Entregado', 'En Stock', 'Cancelado')


def estado_es_taller(estado):
    return bool(
        estado.activo
        and not estado.es_final
        and estado.nombre not in ESTADOS_NO_TALLER
    )


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.CharField(max_length=50)
    notas = serializers.CharField(required=False, allow_blank=True)

    def validate_estado(self, value):
        value = value.strip()
        if not Estado.objects.filter(nombre=value).exists():
            raise serializers.ValidationError('El estado indicado no existe.')
        return value


class CambiarEstadoMasivoSerializer(serializers.Serializer):
    pedido_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    estado_id = serializers.IntegerField(min_value=1)
    notas = serializers.CharField(
        required=False,
        allow_blank=True,
        default='Cambio masivo',
    )

    def validate_pedido_ids(self, value):
        return list(dict.fromkeys(value))


class RegistrarAnticipoSerializer(serializers.Serializer):
    monto = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )


class EstadoV1Serializer(serializers.ModelSerializer):
    es_taller = serializers.SerializerMethodField()

    class Meta:
        model = Estado
        fields = (
            'id',
            'nombre',
            'color',
            'orden',
            'es_final',
            'activo',
            'es_taller',
        )

    def get_es_taller(self, obj):
        return estado_es_taller(obj)


class AnticipoV1Serializer(serializers.ModelSerializer):
    metodo_display = serializers.CharField(
        source='get_metodo_display', read_only=True
    )
    categoria_display = serializers.CharField(
        source='get_categoria_display', read_only=True
    )

    class Meta:
        model = MovimientoCaja
        fields = (
            'id',
            'monto',
            'moneda',
            'metodo',
            'metodo_display',
            'categoria',
            'categoria_display',
            'concepto',
            'fecha',
        )


class ServicioExternoV1Serializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(
        source='get_tipo_display', read_only=True
    )
    estado_display = serializers.CharField(
        source='get_estado_display', read_only=True
    )
    lote_numero = serializers.SerializerMethodField()

    class Meta:
        model = ServicioExterno
        fields = (
            'id',
            'proveedor_id',
            'proveedor_nombre',
            'tipo',
            'tipo_display',
            'monto',
            'estado',
            'estado_display',
            'fecha_solicitud',
            'fecha_recepcion',
            'fecha_pago',
            'notas',
            'lote_id',
            'lote_numero',
        )

    def get_proveedor_nombre(self, obj):
        return obj.proveedor.nombre if obj.proveedor_id else ''

    def get_lote_numero(self, obj):
        return obj.lote.numero if obj.lote_id else None


class PedidoListV1Serializer(serializers.ModelSerializer):
    cliente_id = serializers.IntegerField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    libro_id = serializers.IntegerField(read_only=True)
    libro_titulo = serializers.SerializerMethodField()
    libro_autor = serializers.SerializerMethodField()
    estado_id = serializers.IntegerField(read_only=True)
    estado_nombre = serializers.SerializerMethodField()
    estado_color = serializers.SerializerMethodField()
    estado_es_final = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = (
            'id',
            'referencia_externa',
            'cliente_id',
            'cliente_nombre',
            'libro_id',
            'libro_titulo',
            'libro_autor',
            'cantidad',
            'estado_id',
            'estado_nombre',
            'estado_color',
            'estado_es_final',
            'precio_venta',
            'anticipo_requerido',
            'anticipo_recibido',
            'saldo_pendiente',
            'fecha_pedido',
            'fecha_entrega_prometida',
            'fecha_entrega_real',
            'es_historico',
        )

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente_id else 'Stock / Venta Directa'

    def get_libro_titulo(self, obj):
        return obj.libro.titulo if obj.libro_id else ''

    def get_libro_autor(self, obj):
        return obj.libro.autor if obj.libro_id else ''

    def get_estado_nombre(self, obj):
        return obj.estado.nombre if obj.estado_id else ''

    def get_estado_color(self, obj):
        return obj.estado.color if obj.estado_id else '#6c757d'

    def get_estado_es_final(self, obj):
        return bool(obj.estado.es_final) if obj.estado_id else False


class PedidoDetailV1Serializer(PedidoListV1Serializer):
    cliente_telefono = serializers.SerializerMethodField()
    cliente_direccion = serializers.SerializerMethodField()
    dias_para_entrega = serializers.SerializerMethodField()
    esta_atrasado = serializers.SerializerMethodField()
    ganancia_bruta = serializers.SerializerMethodField()
    anticipos = serializers.SerializerMethodField()
    servicios_externos = ServicioExternoV1Serializer(many=True, read_only=True)

    class Meta(PedidoListV1Serializer.Meta):
        fields = PedidoListV1Serializer.Meta.fields + (
            'lleva_scotch',
            'lleva_esquineros',
            'direccion_entrega',
            'telefono_entrega',
            'notas',
            'descuento_aplicado',
            'horas_invertidas',
            'cliente_telefono',
            'cliente_direccion',
            'dias_para_entrega',
            'esta_atrasado',
            'ganancia_bruta',
            'anticipos',
            'servicios_externos',
        )

    def get_cliente_telefono(self, obj):
        return obj.cliente.telefono if obj.cliente_id else ''

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion if obj.cliente_id else ''

    def get_dias_para_entrega(self, obj):
        return obj.dias_para_entrega

    def get_esta_atrasado(self, obj):
        return obj.esta_atrasado

    def get_ganancia_bruta(self, obj):
        return obj.ganancia_bruta

    def get_anticipos(self, obj):
        movimientos = MovimientoCaja.objects.filter(
            pedido=obj,
            tipo='INGRESO',
        ).order_by('fecha')
        return AnticipoV1Serializer(movimientos, many=True).data
