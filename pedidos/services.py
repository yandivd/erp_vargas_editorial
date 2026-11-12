import logging
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
from clientes.models import Cliente
from django.utils import timezone
from django.db import transaction
from core.models import Parametro
from inventario.models import Material
from .models import Book, Entrega, HistorialEstado, LoteServicio, Pedido, ServicioExterno, Estado
from proveedores.models import Proveedor
from datetime import date, timedelta
from django.utils import timezone


FECHA_CORTE_GANANCIA_PROMEDIO = date(2026, 8, 2)

logger = logging.getLogger(__name__)


# ============================================================
# COSTEADOR
# ============================================================
class CosteadorPedido:
    def __init__(self, pedido):
        self.pedido = pedido

    def _param(self, clave, default=0):
        return Decimal(str(Parametro.get(clave, default)))

    def calcular(self):
        p = self.pedido
        paginas = p.paginas

        # --- PAPEL ---
        paginas_por_hoja = self._param('paginas_por_hoja', 4)
        hojas = (paginas + int(paginas_por_hoja) - 1) // int(paginas_por_hoja)
        precio_paquete = self._param('precio_papel_paquete', 1800)
        hojas_por_paquete = self._param('hojas_por_paquete', 500)
        costo_hoja = precio_paquete / hojas_por_paquete if hojas_por_paquete else 0
        costo_papel = hojas * costo_hoja

        # --- TINTA ---
        precio_tinta = self._param('precio_tinta_litro', 17500)
        rinde_tinta = self._param('rinde_tinta_paginas', 35000)
        costo_por_pagina_tinta = precio_tinta / rinde_tinta if rinde_tinta else 0
        costo_tinta = paginas * costo_por_pagina_tinta

        # --- PEGAMENTO ---
        precio_pegamento = self._param('precio_pegamento', 3500)
        rinde_pegamento = self._param('rinde_pegamento_lomos', 70)
        costo_pegamento = precio_pegamento / rinde_pegamento if rinde_pegamento else 0

        # --- ESQUINEROS ---
        costo_esquineros = Decimal('0')
        if p.lleva_esquineros:
            material_esquineros = Material.objects.filter(nombre__iexact='esquineros').first()
            if material_esquineros:
                cant_esquineros = self._param('esquineros_por_libro', 4)
                costo_esquineros = cant_esquineros * material_esquineros.costo_promedio

        # --- SCOTCH ---
        costo_scotch = Decimal('0')
        if p.lleva_scotch:
            precio_scotch = self._param('precio_scotch', 1000)
            rinde_scotch = self._param('rinde_scotch_libros', 30)
            costo_scotch = precio_scotch / rinde_scotch if rinde_scotch else 0

        # --- PORTADA ---
        costo_portada = self._param('precio_portada', 1000)

        # --- ENCUADERNACIÓN ---
        paginas_grueso = self._param('paginas_para_grueso', 300)
        precio_enc_normal = self._param('precio_encuadernacion', 500)
        precio_enc_grueso = self._param('precio_encuadernacion_grueso', 500)
        costo_encuadernacion = precio_enc_grueso if paginas > paginas_grueso else precio_enc_normal

        # --- ELECTRICIDAD ---
        electricidad = self._param('electricidad_mensual', 1000)
        libros_mes = self._param('libros_por_mes_estimado', 30)
        costo_electricidad = electricidad / libros_mes if libros_mes else 0

        # --- DISEÑO ---
        costo_diseno = self._param('precio_diseno', 500)

        # --- TOTAL ---
        total = (
            costo_papel + costo_tinta + costo_pegamento + costo_scotch + costo_esquineros +
            costo_portada + costo_encuadernacion + costo_electricidad + costo_diseno
        )

        return {
            'hojas': hojas,
            'costo_papel': round(costo_papel, 2),
            'costo_tinta': round(costo_tinta, 2),
            'costo_pegamento': round(costo_pegamento, 2),
            'costo_scotch': round(costo_scotch, 2),
            'costo_portada': round(costo_portada, 2),
            'costo_esquineros': round(costo_esquineros, 2),
            'costo_encuadernacion': round(costo_encuadernacion, 2),
            'costo_electricidad': round(costo_electricidad, 2),
            'costo_diseno': round(costo_diseno, 2),
            'costo_total': round(total, 2),
        }

    def calcular_precio_sugerido(self):
        """Calcula el precio basado en la fórmula del Excel (margen dinámico)."""
        costo = self.calcular()
        costo_total = Decimal(str(costo['costo_total']))
        paginas = Decimal(str(self.pedido.paginas))

        pag_min = Decimal(str(Parametro.get('paginas_min', 100)))
        pag_max = Decimal(str(Parametro.get('paginas_max', 1000)))
        margen_min = Decimal(str(Parametro.get('margen_min', 0.8)))
        margen_max = Decimal(str(Parametro.get('margen_max', 2.0)))

        if pag_max == pag_min:
            pag_max = pag_min + 1

        proporcion = (min(max(paginas, pag_min), pag_max) - pag_min) / (pag_max - pag_min)
        margen = margen_min + (proporcion * (margen_max - margen_min))

        precio_base = costo_total * (Decimal('1') + margen)

        import math
        precio_final = math.ceil(precio_base / 100) * 100

        return Decimal(str(precio_final))


def obtener_ganancia_promedio():
    """
    Promedio de ganancia (precio_venta - costo_total) de los pedidos entregados
    desde el 02/08/2026. Usa la fecha real de entrega o, si falta, la creación.
    """
    from django.db.models.functions import Coalesce

    pedidos = (
        Pedido.objects.filter(estado__nombre='Entregado')
        .annotate(fecha_referencia=Coalesce('fecha_entrega_real', 'fecha_pedido'))
        .filter(fecha_referencia__date__gte=FECHA_CORTE_GANANCIA_PROMEDIO)
        .select_related('libro')
    )

    ganancia_total = Decimal('0')
    cantidad_pedidos = 0

    for pedido in pedidos:
        costo = CosteadorPedido(pedido).calcular()
        ganancia_total += Decimal(str(pedido.precio_venta)) - Decimal(str(costo['costo_total']))
        cantidad_pedidos += 1

    if cantidad_pedidos == 0:
        return Decimal('0')

    return (ganancia_total / cantidad_pedidos).quantize(Decimal('0.01'))


# ============================================================
# SERVICIO DE PEDIDOS
# ============================================================
class ServicioPedido:

    @staticmethod
    def _estado(nombre):
        return Estado.objects.get(nombre=nombre)

    @staticmethod
    def vender_stock(
        pedido,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
        usuario='',
        notas='',
        cliente_id=None,
    ):
        from finanzas.services import ServicioFinanzas

        with transaction.atomic():
            pedido_bloqueado = (
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente', 'estado')
                .get(pk=pedido.pk)
            )

            if pedido_bloqueado.estado is None or pedido_bloqueado.estado.nombre != 'En Stock':
                raise ValueError('El pedido no está disponible para venta en tienda.')

            if pedido_bloqueado.cliente_id is not None:
                raise ValueError('El pedido de tienda ya tiene cliente asignado.')

            if cliente_id:
                cliente = Cliente.objects.get(pk=cliente_id)
            else:
                cliente = Cliente.objects.filter(nombre='Cliente en Tienda').first()
                if cliente is None:
                    cliente = Cliente.objects.create(nombre='Cliente en Tienda')

            pedido_bloqueado.cliente = cliente

            resultado = ServicioFinanzas.registrar_pago_mixto(
                pedido=pedido_bloqueado,
                monto_cup=monto_cup,
                monto_usd=monto_usd,
                tasa_aplicada=tasa_aplicada,
                metodo=metodo,
                categoria='VENTA_DIRECTA',
                concepto=f'Venta en tienda - pedido #{pedido_bloqueado.id} - {pedido_bloqueado.libro.titulo}',
                permitir_vuelto=True,
            )

            pedido = ServicioPedido.cambiar_estado(
                pedido_bloqueado,
                'Entregado',
                usuario=usuario,
                notas=notas or 'Venta en tienda',
            )

        return resultado

    @staticmethod
    def confirmar_entrega(
        entrega,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
        usuario='',
        notas='',
    ):
        from finanzas.services import ServicioFinanzas

        with transaction.atomic():
            entrega_bloqueada = (
                Entrega.objects.select_for_update()
                .select_related('cliente')
                .get(pk=entrega.pk)
            )

            if entrega_bloqueada.entregado:
                raise ValueError('Esta entrega ya fue confirmada.')

            resultado = ServicioFinanzas.registrar_pago_entrega(
                entrega_bloqueada,
                monto_cup=monto_cup,
                monto_usd=monto_usd,
                tasa_aplicada=tasa_aplicada,
                metodo=metodo,
            )

            entrega_bloqueada.entregado = True
            entrega_bloqueada.fecha_entrega_real = timezone.now()
            entrega_bloqueada.save(
                update_fields=['entregado', 'fecha_entrega_real']
            )

            pedidos = list(
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente', 'estado')
                .filter(entregas=entrega_bloqueada)
                .order_by('id')
            )

            for pedido in pedidos:
                if pedido.estado is None or pedido.estado.nombre != 'Entregado':
                    ServicioPedido.cambiar_estado(
                        pedido,
                        'Entregado',
                        usuario=usuario,
                        notas=notas or f'Entrega #{entrega_bloqueada.id} confirmada',
                    )

        return resultado

    @staticmethod
    def cambiar_estado(pedido, nombre_nuevo_estado, usuario='', notas=''):
        estado_anterior = pedido.estado
        nuevo_estado = Estado.objects.get(nombre=nombre_nuevo_estado)

        if estado_anterior and estado_anterior.id == nuevo_estado.id:
            return pedido

        pedido.estado = nuevo_estado
        if nuevo_estado.nombre == 'Entregado':
            pedido.fecha_entrega_real = timezone.now()
        pedido.save()

        HistorialEstado.objects.create(
            pedido=pedido,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            usuario=usuario,
            notas=notas
        )

        # Acciones automáticas
        if nuevo_estado.nombre == 'Pendiente a Carátula':
            ServicioPedido.crear_servicio_portada(pedido)

        elif nuevo_estado.nombre == 'Pendiente a Encuadernado':
            ServicioPedido.crear_servicio_encuadernado(pedido)

        elif nuevo_estado.nombre == 'Listo para Entregar':
            ServicioPedido.consumir_materiales(pedido, momento='ENTREGA')

        elif nuevo_estado.nombre == 'Entregado':
            entrega = pedido.entregas.select_related('cliente').order_by('id').first()

            with transaction.atomic():
                if entrega and not entrega.entregado:
                    entrega.pedidos.remove(pedido)

                ServicioPedido.cobrar_saldo(pedido)

            from clientes.services import ServicioFidelidad

            ServicioFidelidad.registrar_compra(pedido)

        return pedido

    @staticmethod
    def _obtener_o_crear_lote(proveedor, tipo):
        """Devuelve el lote ABIERTO del proveedor+tipo creado en las últimas 2 horas, o crea uno nuevo."""
        hace_dos_horas = timezone.now() - timedelta(hours=2)
        
        # Buscamos un lote abierto que se haya creado recientemente
        lote = LoteServicio.objects.filter(
            proveedor=proveedor,
            tipo=tipo,
            estado='ABIERTO',
            fecha_apertura__gte=hace_dos_horas  # <-- La clave está aquí
        ).order_by('-fecha_apertura').first()
        
        if not lote:
            # Si no hay ninguno reciente, creamos uno nuevo
            lote = LoteServicio.objects.create(
                proveedor=proveedor,
                tipo=tipo
            )
        return lote

    @staticmethod
    def consumir_materiales(pedido, momento='ENTREGA'):
        from inventario.services import ServicioInventario
        return ServicioInventario.consumir_materiales_pedido(pedido, momento)

    @staticmethod
    def crear_servicio_portada(pedido):
        proveedor = Proveedor.objects.filter(tipo='IMPRENTA_PORTADA', activo=True).first()
        if not proveedor:
            return
        monto = Parametro.get('precio_portada', 1080)
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='PORTADA').exists():
            lote = ServicioPedido._obtener_o_crear_lote(proveedor, 'PORTADA')
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='PORTADA',
                monto=monto,
                estado='SOLICITADO',
                lote=lote
            )

    @staticmethod
    def crear_servicio_encuadernado(pedido):
        proveedor = Proveedor.objects.filter(tipo='ENCUADERNADOR', activo=True).first()
        if not proveedor:
            return
        paginas_grueso = int(Parametro.get('paginas_para_grueso', 300) or 300)
        if pedido.paginas > paginas_grueso:
            monto = Parametro.get('precio_encuadernacion_grueso', 500)
        else:
            monto = Parametro.get('precio_encuadernacion', 500)
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='ENCUADERNADO').exists():
            lote = ServicioPedido._obtener_o_crear_lote(proveedor, 'ENCUADERNADO')
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='ENCUADERNADO',
                monto=monto,
                estado='SOLICITADO',
                lote=lote
            )

    @staticmethod
    def cobrar_saldo(pedido):
        """Al entregar, registra el cobro del saldo en caja si queda pendiente."""
        from finanzas.services import ServicioFinanzas

        if pedido.saldo_pendiente > 0:
            ServicioFinanzas.registrar_saldo(pedido, monto=pedido.saldo_pendiente)

    @staticmethod
    def verificar_y_cerrar_lote(lote):
        """Si todos los servicios del lote están PAGADOS, cierra el lote como PAGADO."""
        if not lote:
            return False
        if lote.estado == 'PAGADO':
            return False
        total = lote.servicios.count()
        pagados = lote.servicios.filter(estado='PAGADO').count()
        if total > 0 and total == pagados:
            lote.estado = 'PAGADO'
            lote.fecha_pago = timezone.now()
            if not lote.fecha_cierre:
                lote.fecha_cierre = timezone.now()
            lote.save()
            return True
        return False


def cobrar_saldo_anticipado(
    pedido,
    monto=None,
    usuario=None,
    notas="",
    moneda_pago='CUP',
    tasa_cambio_aplicada=None,
):
    """
    Registra el cobro del saldo pendiente de un pedido antes de que esté entregado.
    - pedido: instancia de Pedido
    - monto: si es None, cobra todo el saldo_pendiente (o el mayor entero en USD).
    - moneda_pago: CUP o USD.
    - tasa_cambio_aplicada: obligatoria para pagos en USD; si falta se usa la actual.
    - Devuelve el MovimientoCaja creado.
    - Lanza ValueError si el pedido ya está pagado, está entregado, es histórico,
      o el monto es inválido.
    """
    from finanzas.services import ServicioFinanzas

    pedido_original = pedido

    with transaction.atomic():
        pedido = (
            Pedido.objects.select_for_update()
            .select_related('cliente', 'libro', 'estado')
            .get(pk=pedido.pk)
        )

        if pedido.es_historico:
            raise ValueError('No se puede cobrar el saldo de un pedido histórico.')

        if pedido.estado and pedido.estado.nombre == 'Entregado':
            raise ValueError('No se puede cobrar el saldo de un pedido entregado.')

        saldo = Decimal(str(pedido.saldo_pendiente or 0)).quantize(Decimal('0.01'))
        if saldo <= 0:
            raise ValueError('Este pedido ya está pagado en su totalidad')

        moneda = (moneda_pago or 'CUP').upper()

        if monto is None:
            if moneda == 'USD':
                tasa = (
                    Decimal(str(tasa_cambio_aplicada))
                    if tasa_cambio_aplicada not in (None, '')
                    else ServicioFinanzas.obtener_tasa_usd_cup()
                )
                if tasa <= 0:
                    raise ValueError('La tasa de cambio debe ser mayor que cero.')
                monto_cobro = (saldo / tasa).to_integral_value(
                    rounding=ROUND_FLOOR
                )
                if monto_cobro <= 0:
                    raise ValueError(
                        'El saldo pendiente es menor a 1 USD; cobra el resto en CUP.'
                    )
            else:
                monto_cobro = saldo
        else:
            try:
                monto_cobro = Decimal(str(monto))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise ValueError('El monto a cobrar no es válido.') from exc

        monto_cobro, monto_cup, moneda, tasa = ServicioFinanzas.normalizar_pago(
            monto_cobro,
            moneda_pago=moneda,
            tasa_cambio_aplicada=tasa_cambio_aplicada,
        )

        if monto_cup > saldo:
            raise ValueError('El monto a cobrar no puede superar el saldo pendiente.')

        cliente = pedido.cliente.nombre if pedido.cliente else 'Sin cliente'
        concepto = f'Saldo pedido #{pedido.id} - {cliente} - {pedido.libro.titulo}'
        if moneda == 'USD':
            concepto = f'{concepto} @ {tasa.normalize():f} CUP/USD'
        concepto = concepto[:200]

        movimiento = ServicioFinanzas.registrar_saldo(
            pedido,
            monto=monto_cobro,
            moneda=moneda,
            tasa_cambio_aplicada=tasa,
            concepto=concepto,
        )
        if movimiento is None:
            raise ValueError('No se pudo registrar el cobro del saldo.')

        logger.info(
            'Cobro anticipado de saldo registrado: pedido=%s monto=%s moneda=%s tasa=%s usuario=%s notas=%s',
            pedido.id,
            monto_cobro,
            moneda,
            tasa,
            usuario,
            notas,
        )

    pedido_original.anticipo_recibido = pedido.anticipo_recibido
    pedido_original.saldo_pendiente = pedido.saldo_pendiente

    return movimiento


# ============================================================
# CATÁLOGO DE LIBROS (PDF)
# ============================================================
class ServicioCatalogo:
    """Prepara el catálogo de libros y lo renderiza como PDF."""

    @staticmethod
    def obtener_contexto():
        libros = list(Book.objects.all().order_by('titulo'))
        return {
            'libros': [
                {
                    'titulo': libro.titulo,
                    'autor': libro.autor or '—',
                    'precio_formateado': f"${libro.precio:,.2f}",
                }
                for libro in libros
            ],
            'total_libros': len(libros),
            'fecha_generacion': timezone.localtime(timezone.now()),
        }

    @staticmethod
    def generar_pdf():
        from django.template.loader import render_to_string
        from weasyprint import HTML

        contexto = ServicioCatalogo.obtener_contexto()
        html = render_to_string('pedidos/catalogo_pdf.html', contexto)
        return HTML(string=html).write_pdf()