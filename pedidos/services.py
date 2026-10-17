from decimal import Decimal
from core.models import Parametro
from inventario.models import Material


class CosteadorPedido:
    """
    Calcula el costo estimado de un pedido basándose en sus páginas
    y en los parámetros del sistema.
    """
    
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
        
        # --- SCOTCH (opcional) ---
        costo_scotch = Decimal('0')
        if p.lleva_scotch:
            precio_scotch = self._param('precio_scotch', 1000)
            rinde_scotch = self._param('rinde_scotch_libros', 30)
            costo_scotch = precio_scotch / rinde_scotch if rinde_scotch else 0
        
        # --- PORTADA ---
        costo_portada = self._param('precio_portada', 1000)
        
        # --- ENCUADERNACIÓN ---
        # Regla: si el libro es grueso (más de X páginas) cobra más
        paginas_grueso = self._param('paginas_para_grueso', 300)
        precio_encuadernacion_normal = self._param('precio_encuadernacion', 500)
        precio_encuadernacion_grueso = self._param('precio_encuadernacion_grueso', 500)
        if paginas > paginas_grueso:
            costo_encuadernacion = precio_encuadernacion_grueso
        else:
            costo_encuadernacion = precio_encuadernacion_normal
        
        # --- ELECTRICIDAD ---
        electricidad = self._param('electricidad_mensual', 1000)
        libros_mes = self._param('libros_por_mes_estimado', 30)
        costo_electricidad = electricidad / libros_mes if libros_mes else 0
        
        # --- DISEÑO ---
        costo_diseno = self._param('precio_diseno', 500)
        
        # --- TOTAL ---
        total = (
            costo_papel + costo_tinta + costo_pegamento + costo_scotch +
            costo_portada + costo_encuadernacion + costo_electricidad + costo_diseno
        )
        
        return {
            'hojas': hojas,
            'costo_papel': round(costo_papel, 2),
            'costo_tinta': round(costo_tinta, 2),
            'costo_pegamento': round(costo_pegamento, 2),
            'costo_scotch': round(costo_scotch, 2),
            'costo_portada': round(costo_portada, 2),
            'costo_encuadernacion': round(costo_encuadernacion, 2),
            'costo_electricidad': round(costo_electricidad, 2),
            'costo_diseno': round(costo_diseno, 2),
            'costo_total': round(total, 2),
        }

from .models import HistorialEstado, ServicioExterno
from inventario.services import ServicioInventario


class ServicioPedido:
    """
    Maneja el flujo de estados y las acciones automáticas.
    """
    
    # Definir qué pasa en cada transición de estado
    ACCIONES_POR_ESTADO = {
        'Impreso': 'consumir_materiales',
        'Portada solicitada': 'crear_servicio_portada',
        'Encuadernando': 'crear_servicio_encuadernado',
        'Entregado': 'cerrar_pedido',
    }
    
    @staticmethod
    def cambiar_estado(pedido, nuevo_estado, usuario='', notas=''):
        """Cambia el estado del pedido y ejecuta acciones automáticas."""
        estado_anterior = pedido.estado
        
        if estado_anterior == nuevo_estado:
            return pedido
        
        # Actualizar estado
        pedido.estado = nuevo_estado
        if nuevo_estado == 'Entregado':
            from django.utils import timezone
            pedido.fecha_entrega_real = timezone.now()
        pedido.save()
        
        # Registrar en historial
        HistorialEstado.objects.create(
            pedido=pedido,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            usuario=usuario,
            notas=notas
        )
        
        # Ejecutar acciones automáticas
        accion = ServicioPedido.ACCIONES_POR_ESTADO.get(nuevo_estado)
        if accion:
            metodo = getattr(ServicioPedido, accion, None)
            if metodo:
                metodo(pedido)
        
        return pedido
    
    @staticmethod
    def consumir_materiales(pedido):
        """Al imprimir, descuenta los materiales del inventario."""
        ServicioInventario.consumir_materiales_pedido(pedido)
    
    @staticmethod
    def crear_servicio_portada(pedido):
        """Al pedir la portada, crea el servicio externo."""
        from proveedores.models import Proveedor
        from core.models import Parametro
        
        proveedor = Proveedor.objects.filter(tipo='IMPRENTA_PORTADA', activo=True).first()
        if not proveedor:
            return
        
        monto = Parametro.get('precio_portada', 1000)
        
        # Evitar duplicados
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='PORTADA').exists():
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='PORTADA',
                monto=monto,
                estado='SOLICITADO'
            )
    
    @staticmethod
    def crear_servicio_encuadernado(pedido):
        """Al enviar al encuadernador, crea el servicio externo."""
        from proveedores.models import Proveedor
        from core.models import Parametro
        
        proveedor = Proveedor.objects.filter(tipo='ENCUADERNADOR', activo=True).first()
        if not proveedor:
            return
        
        # Determinar precio según grosor
        paginas_grueso = int(Parametro.get('paginas_para_grueso', 300) or 300)
        if pedido.paginas > paginas_grueso:
            monto = Parametro.get('precio_encuadernacion_grueso', 500)
        else:
            monto = Parametro.get('precio_encuadernacion', 500)
        
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='ENCUADERNADO').exists():
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='ENCUADERNADO',
                monto=monto,
                estado='SOLICITADO'
            )
    
    @staticmethod
    def cerrar_pedido(pedido):
        """Al entregar, ajusta el saldo y calcula ganancia."""
        pedido.saldo_pendiente = pedido.precio_venta - pedido.anticipo_recibido
        pedido.save()