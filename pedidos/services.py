from decimal import Decimal
from django.utils import timezone
from core.models import Parametro
from inventario.models import Material
from .models import HistorialEstado, LoteServicio, ServicioExterno, Estado
from proveedores.models import Proveedor


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


# ============================================================
# SERVICIO DE PEDIDOS
# ============================================================
class ServicioPedido:

    @staticmethod
    def _estado(nombre):
        return Estado.objects.get(nombre=nombre)

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
            ServicioPedido.cobrar_saldo(pedido)

        return pedido

    @staticmethod
    def _obtener_o_crear_lote(proveedor, tipo):
        """Devuelve el lote ABIERTO del proveedor+tipo, o crea uno nuevo."""
        lote = LoteServicio.objects.filter(
            proveedor=proveedor,
            tipo=tipo,
            estado='ABIERTO'
        ).order_by('-fecha_apertura').first()

        if not lote:
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