from decimal import Decimal

from django.db.models import Q
from rest_framework import serializers

from clientes.models import Cliente
from finanzas.models import MovimientoCaja
from finanzas.services import ServicioFinanzas
from pedidos.models import Book, CodigoDescuento, Estado, Pedido, ServicioExterno
from pedidos.services import CosteadorPedido


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
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
    monto_cup = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    monto_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    tasa_aplicada = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=False,
        allow_null=True,
    )

    def validate_estado(self, value):
        value = value.strip()
        if not Estado.objects.filter(nombre=value).exists():
            raise serializers.ValidationError('El estado indicado no existe.')
        return value

    def validate(self, attrs):
        monto_cup = attrs.get('monto_cup') or Decimal('0')
        monto_usd = attrs.get('monto_usd') or Decimal('0')

        if monto_cup > 0 or monto_usd > 0:
            try:
                monto_cup, monto_usd, _, tasa = (
                    ServicioFinanzas.normalizar_pago_mixto(
                        monto_cup=monto_cup,
                        monto_usd=monto_usd,
                        tasa_aplicada=attrs.get('tasa_aplicada'),
                    )
                )
            except ValueError as error:
                raise serializers.ValidationError(str(error)) from error
        else:
            tasa = None

        attrs['monto_cup'] = monto_cup
        attrs['monto_usd'] = monto_usd
        attrs['tasa_aplicada'] = tasa
        return attrs


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
        required=False,
        allow_null=True,
    )
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
    moneda_pago = serializers.ChoiceField(
        choices=MovimientoCaja.MONEDA_CHOICES,
        default='CUP',
        required=False,
    )
    tasa_cambio_aplicada = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=False,
        allow_null=True,
    )
    monto_cup = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    monto_usd = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    tasa_aplicada = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        monto_cup = attrs.get('monto_cup') or Decimal('0')
        monto_usd = attrs.get('monto_usd') or Decimal('0')
        tasa = attrs.get('tasa_aplicada')
        monto = attrs.get('monto')

        if monto_cup <= 0 and monto_usd <= 0:
            if monto is None:
                raise serializers.ValidationError(
                    'Indica al menos un monto en CUP o USD.'
                )

            moneda = attrs.get('moneda_pago') or 'CUP'
            if moneda == 'USD':
                monto_usd = monto
                if tasa is None:
                    tasa = attrs.get('tasa_cambio_aplicada')
            else:
                monto_cup = monto
                tasa = None

        try:
            monto_cup, monto_usd, _, tasa = (
                ServicioFinanzas.normalizar_pago_mixto(
                    monto_cup=monto_cup,
                    monto_usd=monto_usd,
                    tasa_aplicada=tasa,
                )
            )
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

        attrs['monto_cup'] = monto_cup
        attrs['monto_usd'] = monto_usd
        attrs['tasa_aplicada'] = tasa
        attrs['moneda_pago'] = 'USD' if monto_usd > 0 else 'CUP'
        attrs['tasa_cambio_aplicada'] = tasa
        return attrs


class ClienteListV1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ('id', 'nombre', 'telefono')


class LibroListV1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ('id', 'titulo', 'autor', 'paginas', 'precio')


class PedidoCreateSerializer(serializers.Serializer):
    cliente_id = serializers.IntegerField(required=False, allow_null=True)
    cliente_nombre = serializers.CharField(required=False, allow_blank=True)
    cliente_telefono = serializers.CharField(required=False, allow_blank=True)
    cliente_direccion = serializers.CharField(required=False, allow_blank=True)
    libro_id = serializers.IntegerField(required=False, allow_null=True)
    libro_titulo = serializers.CharField(required=False, allow_blank=True)
    libro_autor = serializers.CharField(required=False, allow_blank=True)
    libro_paginas = serializers.IntegerField(required=False, allow_null=True)
    cantidad = serializers.IntegerField(default=1, min_value=1)
    lleva_scotch = serializers.BooleanField(default=False)
    lleva_esquineros = serializers.BooleanField(default=False)
    precio_venta = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    anticipo_requerido = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=0,
        min_value=Decimal('0'),
    )
    monto_anticipo = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal('0'),
    )
    moneda_anticipo = serializers.ChoiceField(
        choices=MovimientoCaja.MONEDA_CHOICES,
        default='CUP',
        required=False,
    )
    tasa_cambio = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        required=False,
        allow_null=True,
        min_value=Decimal('0.0001'),
    )
    notas = serializers.CharField(required=False, allow_blank=True)
    codigo_descuento = serializers.CharField(required=False, allow_blank=True)
    descuento_aplicado = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)

    def validate(self, attrs):
        if not attrs.get('cliente_id') and not attrs.get('cliente_nombre'):
            raise serializers.ValidationError('Debes seleccionar un cliente o crear uno nuevo.')
        if not attrs.get('libro_id') and not attrs.get('libro_titulo'):
            raise serializers.ValidationError('Debes seleccionar un libro o crear uno nuevo.')
        if not attrs.get('libro_id') and not attrs.get('libro_paginas'):
            raise serializers.ValidationError('Si creas un libro nuevo, debes indicar las páginas.')

        monto_anticipo = attrs.get('monto_anticipo')
        if monto_anticipo is None:
            monto_anticipo = attrs.get('anticipo_requerido') or Decimal('0')
        moneda_anticipo = attrs.get('moneda_anticipo') or 'CUP'
        tasa_cambio = attrs.get('tasa_cambio')

        if monto_anticipo < 0:
            raise serializers.ValidationError({
                'monto_anticipo': 'El anticipo no puede ser negativo.',
            })

        if monto_anticipo > 0:
            try:
                monto_anticipo, anticipo_cup, moneda_anticipo, tasa_cambio = (
                    ServicioFinanzas.normalizar_pago(
                        monto_anticipo,
                        moneda_pago=moneda_anticipo,
                        tasa_cambio_aplicada=tasa_cambio,
                    )
                )
            except ValueError as error:
                raise serializers.ValidationError({
                    'monto_anticipo': str(error),
                }) from error

        else:
            anticipo_cup = Decimal('0')
            tasa_cambio = None

        attrs['monto_anticipo'] = monto_anticipo
        attrs['moneda_anticipo'] = moneda_anticipo
        attrs['tasa_cambio'] = tasa_cambio
        attrs['anticipo_requerido'] = anticipo_cup
        return attrs


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
            'tipo',
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
    libro_paginas = serializers.SerializerMethodField()
    dias_para_entrega = serializers.SerializerMethodField()
    esta_atrasado = serializers.SerializerMethodField()
    costo_produccion = serializers.SerializerMethodField()
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
            'libro_paginas',
            'dias_para_entrega',
            'esta_atrasado',
            'costo_produccion',
            'ganancia_bruta',
            'anticipos',
            'servicios_externos',
        )

    def get_cliente_telefono(self, obj):
        return obj.cliente.telefono if obj.cliente_id else ''

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion if obj.cliente_id else ''

    def get_libro_paginas(self, obj):
        return obj.libro.paginas if obj.libro_id else 0

    def get_dias_para_entrega(self, obj):
        return obj.dias_para_entrega

    def get_esta_atrasado(self, obj):
        return obj.esta_atrasado

    def _costo_produccion(self, obj):
        if not hasattr(obj, '_costo_produccion_cache'):
            obj._costo_produccion_cache = CosteadorPedido(obj).calcular()['costo_total']
        return obj._costo_produccion_cache

    def get_costo_produccion(self, obj):
        return Decimal(str(self._costo_produccion(obj)))

    def get_ganancia_bruta(self, obj):
        costo = Decimal(str(self._costo_produccion(obj)))
        return obj.precio_venta - costo

    def get_anticipos(self, obj):
        movimientos = MovimientoCaja.objects.filter(
            pedido=obj,
        ).filter(
            Q(tipo='INGRESO')
            | Q(tipo='EGRESO', categoria='VUELTO_CLIENTE')
        ).order_by('fecha', 'id')
        return AnticipoV1Serializer(movimientos, many=True).data
