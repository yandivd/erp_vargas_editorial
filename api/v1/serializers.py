from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import serializers

from clientes.models import Cliente
from clientes.services import ServicioFidelidad
from empleados.models import Empleado, PagoNomina
from finanzas.models import ActivoFijo, CierreCaja, MovimientoCaja
from finanzas.services import ServicioFinanzas
from pedidos.models import (
    Book,
    CodigoDescuento,
    Entrega,
    Estado,
    LoteServicio,
    Pedido,
    ServicioExterno,
)
from pedidos.services import CosteadorPedido
from proveedores.models import Proveedor


ESTADOS_NO_TALLER = ('Entregado', 'En Stock', 'Cancelado')

CATEGORIAS_MANUALES_CAJA = {
    'INGRESO': {
        'INGRESO_MANUAL',
        'PROPINA',
        'MENSAJERIA',
        'VENTA_DIRECTA',
        'OTRO_INGRESO',
    },
    'EGRESO': {
        'GASTO_OPERATIVO',
        'COMPRA_MATERIAL',
        'PAGO_PROVEEDOR',
        'COMPRA_ACTIVO',
    },
}


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


ESTADOS_CLIENTE_EXCLUIDOS = ('Entregado', 'Cancelado')


class ClienteListV1Serializer(serializers.ModelSerializer):
    pedidos = serializers.SerializerMethodField()
    saldo_pendiente = serializers.SerializerMethodField()
    total_libros = serializers.SerializerMethodField()
    dias_sin_comprar = serializers.SerializerMethodField()
    badge = serializers.SerializerMethodField()
    fidelidad = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = (
            'id',
            'nombre',
            'telefono',
            'direccion',
            'notas',
            'fecha_registro',
            'pedidos',
            'saldo_pendiente',
            'total_libros',
            'dias_sin_comprar',
            'badge',
            'fidelidad',
        )

    def get_pedidos(self, obj):
        anotado = getattr(obj, 'pedidos_totales', None)
        if anotado is not None:
            return anotado
        return obj.pedidos.exclude(
            estado__nombre__in=ESTADOS_CLIENTE_EXCLUIDOS,
        ).count()

    def get_saldo_pendiente(self, obj):
        anotado = getattr(obj, 'saldo_pendiente_total_db', None)
        if anotado is not None:
            return float(anotado)
        return float(obj.saldo_pendiente_total)

    def get_total_libros(self, obj):
        return obj.total_libros

    def get_dias_sin_comprar(self, obj):
        return obj.dias_sin_comprar

    def get_badge(self, obj):
        return obj.badge

    def get_fidelidad(self, obj):
        return ServicioFidelidad.estado(obj)


class ClienteCreateV1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = ('id', 'nombre', 'telefono', 'direccion', 'notas')

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return value


class AjusteFidelidadSerializer(serializers.Serializer):
    sellos = serializers.IntegerField(
        min_value=0,
        required=False,
        allow_null=True,
    )
    bono_saldo = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
        allow_null=True,
    )
    motivo = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('sellos') is None and attrs.get('bono_saldo') is None:
            raise serializers.ValidationError(
                'Indica la cantidad de sellos o el saldo del bono.'
            )
        return attrs


class LibroListV1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ('id', 'titulo', 'autor', 'paginas', 'precio', 'imagen')
        extra_kwargs = {
            'imagen': {'required': False, 'allow_null': True},
        }

    def validate_titulo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El título es obligatorio.')
        return value

    def validate_paginas(self, value):
        if value <= 0:
            raise serializers.ValidationError('Las páginas deben ser mayores que cero.')
        return value

    def validate_precio(self, value):
        if value < 0:
            raise serializers.ValidationError('El precio no puede ser negativo.')
        return value


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
    precio_venta = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=True,
        min_value=Decimal('0'),
    )
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
    descuento_aplicado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=0,
        min_value=Decimal('0'),
    )
    bono_fidelidad_aplicado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        default=0,
        min_value=Decimal('0'),
    )

    def validate(self, attrs):
        if not attrs.get('cliente_id') and not attrs.get('cliente_nombre'):
            raise serializers.ValidationError('Debes seleccionar un cliente o crear uno nuevo.')
        if not attrs.get('libro_id') and not attrs.get('libro_titulo'):
            raise serializers.ValidationError('Debes seleccionar un libro o crear uno nuevo.')
        if not attrs.get('libro_id') and not attrs.get('libro_paginas'):
            raise serializers.ValidationError('Si creas un libro nuevo, debes indicar las páginas.')
        if attrs.get('bono_fidelidad_aplicado') and not attrs.get('cliente_id'):
            raise serializers.ValidationError(
                'El bono de fidelidad solo aplica a clientes registrados.'
            )

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
    cliente_direccion = serializers.SerializerMethodField()
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
            'cliente_direccion',
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

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion if obj.cliente_id else ''

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
            'bono_fidelidad_aplicado',
            'horas_invertidas',
            'cliente_telefono',
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

from pedidos.models import Pedido

class TiendaPedidoSerializer(serializers.ModelSerializer):
    libro_titulo = serializers.CharField(source='libro.titulo', read_only=True)
    libro_autor = serializers.CharField(source='libro.autor', read_only=True)
    estado_nombre = serializers.CharField(source='estado.nombre', read_only=True)

    class Meta:
        model = Pedido
        fields = [
            'id', 
            'libro_titulo', 
            'libro_autor', 
            'precio_venta', 
            'cantidad', 
            'estado_nombre', 
            'referencia_externa'
        ]


class CrearEntregaSerializer(serializers.Serializer):
    pedido_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    direccion = serializers.CharField(required=False, allow_blank=True, default='')
    costo_mensajeria = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    fecha_entrega = serializers.DateField(required=False, allow_null=True)
    notas = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_pedido_ids(self, value):
        return list(dict.fromkeys(value))


class ConfirmarEntregaSerializer(serializers.Serializer):
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
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
    notas = serializers.CharField(required=False, allow_blank=True, default='')


class EntregaPedidoV1Serializer(serializers.ModelSerializer):
    libro_titulo = serializers.CharField(source='libro.titulo', read_only=True)
    libro_autor = serializers.CharField(source='libro.autor', read_only=True)
    estado_nombre = serializers.CharField(source='estado.nombre', read_only=True)
    servicios_externos = ServicioExternoV1Serializer(many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = (
            'id',
            'referencia_externa',
            'libro_titulo',
            'libro_autor',
            'cantidad',
            'precio_venta',
            'anticipo_recibido',
            'saldo_pendiente',
            'estado_nombre',
            'servicios_externos',
        )


class EntregaListV1Serializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cantidad_pedidos = serializers.IntegerField(read_only=True)
    total_pedidos = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_anticipos = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    saldo_pedidos = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_a_cobrar = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Entrega
        fields = (
            'id',
            'cliente_id',
            'cliente_nombre',
            'direccion',
            'fecha_creacion',
            'fecha_entrega',
            'fecha_entrega_real',
            'entregado',
            'estado',
            'cantidad_pedidos',
            'total_pedidos',
            'total_anticipos',
            'saldo_pedidos',
            'costo_mensajeria',
            'total_a_cobrar',
        )

    def get_estado(self, obj):
        return 'Entregada' if obj.entregado else 'Pendiente'


class EntregaDetailV1Serializer(EntregaListV1Serializer):
    cliente_telefono = serializers.CharField(
        source='cliente.telefono', read_only=True
    )
    cliente_direccion = serializers.CharField(
        source='cliente.direccion', read_only=True
    )
    pedidos = EntregaPedidoV1Serializer(many=True, read_only=True)
    notas = serializers.CharField(read_only=True)

    class Meta(EntregaListV1Serializer.Meta):
        fields = EntregaListV1Serializer.Meta.fields + (
            'cliente_telefono',
            'cliente_direccion',
            'notas',
            'pedidos',
        )


class ClienteDetailV1Serializer(ClienteListV1Serializer):
    estadisticas = serializers.SerializerMethodField()
    historial_pedidos = serializers.SerializerMethodField()

    class Meta(ClienteListV1Serializer.Meta):
        fields = ClienteListV1Serializer.Meta.fields + (
            'estadisticas',
            'historial_pedidos',
        )

    def get_estadisticas(self, obj):
        pedidos = obj.pedidos.all()
        return {
            'total_pedidos': pedidos.count(),
            'total_facturado': float(
                pedidos.aggregate(total=Sum('precio_venta'))['total'] or 0
            ),
            'total_pagado': float(
                pedidos.aggregate(total=Sum('anticipo_recibido'))['total'] or 0
            ),
            'total_deuda': float(
                pedidos.aggregate(total=Sum('saldo_pendiente'))['total'] or 0
            ),
        }

    def get_historial_pedidos(self, obj):
        pedidos = (
            obj.pedidos.select_related('cliente', 'libro', 'estado')
            .order_by('-fecha_pedido')
        )
        return PedidoListV1Serializer(pedidos, many=True).data


class ProveedorV1Serializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    deuda_total = serializers.SerializerMethodField()

    class Meta:
        model = Proveedor
        fields = (
            'id',
            'nombre',
            'tipo',
            'tipo_label',
            'telefono',
            'direccion',
            'notas',
            'activo',
            'deuda_total',
        )

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return value

    def get_deuda_total(self, obj):
        if hasattr(obj, 'deuda_total_db'):
            return float(obj.deuda_total_db or 0)
        total = obj.servicioexterno_set.filter(
            estado__in=['SOLICITADO', 'RECIBIDO']
        ).aggregate(total=Sum('monto'))['total']
        return float(total or 0)


class ServicioExternoResumenV1Serializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    pedido_id = serializers.IntegerField(read_only=True)
    referencia_externa = serializers.SerializerMethodField()
    libro_titulo = serializers.SerializerMethodField()
    cantidad = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    monto = serializers.FloatField()

    class Meta:
        model = ServicioExterno
        fields = (
            'id',
            'pedido_id',
            'referencia_externa',
            'libro_titulo',
            'cantidad',
            'cliente_nombre',
            'tipo',
            'tipo_label',
            'monto',
            'estado',
            'estado_label',
        )

    def get_referencia_externa(self, obj):
        return obj.pedido.referencia_externa if obj.pedido_id else None

    def get_libro_titulo(self, obj):
        return obj.pedido.libro.titulo if obj.pedido_id else ''

    def get_cantidad(self, obj):
        return obj.pedido.cantidad if obj.pedido_id else 0

    def get_cliente_nombre(self, obj):
        cliente = obj.pedido.cliente if obj.pedido_id else None
        return cliente.nombre if cliente else 'Stock / Venta Directa'


class LoteServicioV1Serializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    servicios = ServicioExternoResumenV1Serializer(many=True, read_only=True)
    cantidad_servicios = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    total_pendiente = serializers.SerializerMethodField()

    class Meta:
        model = LoteServicio
        fields = (
            'id',
            'numero',
            'tipo',
            'tipo_label',
            'estado',
            'estado_label',
            'fecha_apertura',
            'fecha_cierre',
            'fecha_pago',
            'notas',
            'cantidad_servicios',
            'total',
            'total_pendiente',
            'servicios',
        )

    def get_cantidad_servicios(self, obj):
        return len(obj.servicios.all())

    def get_total(self, obj):
        return float(sum((servicio.monto for servicio in obj.servicios.all()), Decimal('0')))

    def get_total_pendiente(self, obj):
        total = sum(
            (
                servicio.monto
                for servicio in obj.servicios.all()
                if servicio.estado in ('SOLICITADO', 'RECIBIDO')
            ),
            Decimal('0'),
        )
        return float(total)


class MovimientoCajaV1Serializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    categoria_label = serializers.CharField(source='get_categoria_display', read_only=True)
    metodo_label = serializers.CharField(source='get_metodo_display', read_only=True)
    moneda_label = serializers.CharField(source='get_moneda_display', read_only=True)
    monto = serializers.FloatField()
    pedido_id = serializers.IntegerField(read_only=True)
    proveedor_id = serializers.IntegerField(read_only=True)
    proveedor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCaja
        fields = (
            'id',
            'tipo',
            'tipo_label',
            'categoria',
            'categoria_label',
            'monto',
            'moneda',
            'moneda_label',
            'metodo',
            'metodo_label',
            'concepto',
            'fecha',
            'pedido_id',
            'proveedor_id',
            'proveedor_nombre',
        )

    def get_proveedor_nombre(self, obj):
        return obj.proveedor.nombre if obj.proveedor_id else ''


class ActivoFijoV1Serializer(serializers.ModelSerializer):
    valor_compra = serializers.FloatField()
    valor_residual = serializers.FloatField()
    total_depreciable = serializers.FloatField(read_only=True)
    depreciacion_mensual = serializers.SerializerMethodField()
    depreciacion_acumulada = serializers.SerializerMethodField()
    valor_en_libros = serializers.SerializerMethodField()
    meses_transcurridos = serializers.SerializerMethodField()
    estado_label = serializers.SerializerMethodField()

    class Meta:
        model = ActivoFijo
        fields = (
            'id',
            'nombre',
            'fecha_compra',
            'valor_compra',
            'vida_util_meses',
            'valor_residual',
            'total_depreciable',
            'depreciacion_mensual',
            'depreciacion_acumulada',
            'valor_en_libros',
            'meses_transcurridos',
            'activo',
            'estado_label',
        )

    def get_depreciacion_mensual(self, obj):
        return float(obj.depreciacion_mensual)

    def get_depreciacion_acumulada(self, obj):
        return float(obj.depreciacion_acumulada_calculada)

    def get_valor_en_libros(self, obj):
        return float(obj.valor_en_libros)

    def get_meses_transcurridos(self, obj):
        return obj.meses_transcurridos

    def get_estado_label(self, obj):
        return 'Activo' if obj.activo else 'Inactivo'


class RegistrarMovimientoCajaSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=MovimientoCaja.TIPO_CHOICES)
    categoria = serializers.ChoiceField(
        choices=MovimientoCaja.CATEGORIA_CHOICES,
        required=False,
    )
    monto = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    moneda = serializers.ChoiceField(
        choices=MovimientoCaja.MONEDA_CHOICES,
        default='CUP',
        required=False,
    )
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
    concepto = serializers.CharField(max_length=200)

    def validate_concepto(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El concepto es obligatorio.')
        return value

    def validate(self, attrs):
        tipo = attrs['tipo']
        categoria = attrs.get('categoria')
        permitidas = CATEGORIAS_MANUALES_CAJA[tipo]

        if not categoria:
            categoria = (
                'INGRESO_MANUAL' if tipo == 'INGRESO' else 'GASTO_OPERATIVO'
            )

        if categoria not in permitidas:
            raise serializers.ValidationError({
                'categoria': (
                    'La categoría seleccionada no está permitida para un '
                    f'{tipo.lower()} manual.'
                ),
            })

        attrs['categoria'] = categoria
        return attrs


class RegistrarArqueoSerializer(serializers.Serializer):
    efectivo = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
    )
    efectivo_cup = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
    )
    transferencias = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0'),
        default=Decimal('0'),
        required=False,
    )
    efectivo_usd = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
    )
    notas = serializers.CharField(required=False, allow_blank=True)

    def validate_notas(self, value):
        return value.strip()

    def validate(self, attrs):
        if 'efectivo' in attrs:
            attrs['efectivo_cup'] = attrs.pop('efectivo')
        if 'efectivo_cup' not in attrs:
            raise serializers.ValidationError({
                'efectivo': 'El efectivo contado es obligatorio.',
            })
        return attrs


class RegistrarCompraDivisaSerializer(serializers.Serializer):
    monto_usd = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True,
    )
    tasa_cambio = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=True,
    )


class RegistrarVentaDivisaSerializer(serializers.Serializer):
    monto_usd = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True,
    )
    tasa_cambio = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=True,
    )


class CierreCajaV1Serializer(serializers.ModelSerializer):
    saldo_esperado_cup = serializers.FloatField(source='saldo_sistema')
    saldo_real_cup = serializers.FloatField(source='efectivo_real')
    diferencia_cup = serializers.FloatField(source='diferencia')
    saldo_esperado_usd = serializers.FloatField(source='saldo_sistema_usd')
    saldo_real_usd = serializers.FloatField(source='efectivo_real_usd')
    diferencia_usd = serializers.FloatField()
    transferencia = serializers.FloatField()
    cantidades = serializers.SerializerMethodField()

    def get_cantidades(self, obj):
        denominaciones = (
            20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1,
        )
        return {
            str(denominacion): cantidad
            for denominacion in denominaciones
            if (cantidad := getattr(obj, f'b_{denominacion}', 0)) > 0
        }

    class Meta:
        model = CierreCaja
        fields = (
            'id',
            'fecha',
            'usuario',
            'saldo_esperado_cup',
            'saldo_real_cup',
            'diferencia_cup',
            'saldo_esperado_usd',
            'saldo_real_usd',
            'diferencia_usd',
            'transferencia',
            'cantidades',
            'notas',
        )


class PagoNominaV1Serializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source='empleado.nombre', read_only=True)
    tipo_label = serializers.CharField(source='get_tipo_display', read_only=True)
    moneda_label = serializers.CharField(source='get_moneda_display', read_only=True)
    monto_pagado = serializers.FloatField(read_only=True)
    tasa_aplicada = serializers.FloatField(read_only=True, allow_null=True)

    class Meta:
        model = PagoNomina
        fields = (
            'id',
            'empleado_id',
            'empleado_nombre',
            'tipo',
            'tipo_label',
            'fecha',
            'mes_correspondiente',
            'monto_pagado',
            'moneda',
            'moneda_label',
            'tasa_aplicada',
            'notas',
            'fecha_registro',
        )


class EmpleadoV1Serializer(serializers.ModelSerializer):
    cargo_label = serializers.CharField(source='get_cargo_display', read_only=True)
    salario_base = serializers.FloatField(min_value=0)
    pagos = PagoNominaV1Serializer(many=True, read_only=True)

    class Meta:
        model = Empleado
        fields = (
            'id',
            'nombre',
            'cargo',
            'cargo_label',
            'telefono',
            'salario_base',
            'activo',
            'pagos',
        )

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return value


class PagarEmpleadoSerializer(serializers.Serializer):
    monto = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    moneda = serializers.ChoiceField(
        choices=PagoNomina.MONEDA_CHOICES,
        default='CUP',
        required=False,
    )
    tasa = serializers.DecimalField(
        max_digits=12,
        decimal_places=4,
        min_value=Decimal('0.0001'),
        required=False,
        allow_null=True,
    )
    concepto = serializers.CharField(default='SALARIO', required=False)
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
    mes_correspondiente = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50,
    )
    notas = serializers.CharField(required=False, allow_blank=True)

    def validate_concepto(self, value):
        normalizado = str(value or 'SALARIO').strip().upper().replace(' ', '_')
        if normalizado in ('SALARIO', 'SALARIO_FIJO'):
            return 'SALARIO'
        if normalizado in (
            'UTILIDADES',
            'RETIRO_UTILIDADES',
            'RETIRO_DE_UTILIDADES',
        ):
            return 'UTILIDADES'
        raise serializers.ValidationError(
            'El concepto debe ser Salario o Retiro de Utilidades.'
        )

    def validate(self, attrs):
        try:
            monto, _, moneda, tasa = ServicioFinanzas.normalizar_pago(
                attrs.get('monto'),
                moneda_pago=attrs.get('moneda', 'CUP'),
                tasa_cambio_aplicada=attrs.get('tasa'),
            )
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

        attrs['monto'] = monto
        attrs['moneda'] = moneda
        attrs['tasa'] = tasa
        attrs.setdefault('concepto', 'SALARIO')
        return attrs
