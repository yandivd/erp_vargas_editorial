from decimal import Decimal
from .models import Material, MovimientoInventario, LoteConsumo


class ServicioInventario:
    """
    Maneja los movimientos de entrada y salida de inventario.
    """
    @staticmethod
    def registrar_compra(material, cantidad, costo_unitario, proveedor=None, motivo=''):
        mov = MovimientoInventario.objects.create(
            material=material,
            tipo='ENTRADA',
            cantidad=cantidad,
            costo_unitario=costo_unitario,
            proveedor=proveedor,
            motivo=motivo or f'Compra de {material.nombre}'
        )
        
        # Si tiene fraccionamiento, creamos los lotes
        if material.cantidad_por_unidad and material.cantidad_por_unidad > 1:
            total_lotes = int(cantidad * material.cantidad_por_unidad)
            costo_total_compra = cantidad * costo_unitario
            costo_por_lote = costo_total_compra / total_lotes
            
            for i in range(total_lotes):
                ultimo_lote = LoteConsumo.objects.filter(material=material).count()
                codigo = f"{material.nombre[:4].upper()}-{ultimo_lote + 1:03d}"
                
                LoteConsumo.objects.create(
                    material=material,
                    codigo=codigo,
                    cantidad_inicial=1,
                    cantidad_actual=1,
                    costo_total=costo_por_lote,
                    estado='CERRADO'
                )
            
            material.stock_consumo += total_lotes
            material.save()
            
        return mov

    @staticmethod
    def registrar_consumo(material, cantidad, pedido=None, motivo=''):
        """Registra una salida por uso en producción."""
        from decimal import Decimal
        cantidad = Decimal(str(cantidad))

        # El save() del modelo se encarga de restar el stock y calcular el costo_total
        return MovimientoInventario.objects.create(
            material=material,
            tipo='SALIDA',
            cantidad=cantidad,
            costo_unitario=material.costo_promedio,
            pedido=pedido,
            motivo=motivo or (f'Consumo en pedido #{pedido.id}' if pedido else 'Salida manual')
        )
    
    @staticmethod
    def consumir_materiales_pedido(pedido, momento=None):
        """Solo consume esquineros cuando el pedido pasa a 'Listo para Entregar' y los lleva.
        
        Hojas, tinta, pegamento y scotch se controlan manualmente.
        """
        from core.models import Parametro
        from decimal import Decimal

        movimientos = []

        # Solo esquineros, y solo en el momento de entrega
        if momento in (None, 'ENTREGA', 'ESQUINEROS'):
            if pedido.lleva_esquineros:
                material_esq = Material.objects.filter(nombre__iexact='esquineros', activo=True).first()
                if material_esq:
                    cant_esq = Decimal(str(Parametro.get('esquineros_por_libro', 4)))
                    mov = ServicioInventario.registrar_consumo(
                        material_esq, cant_esq, pedido,
                        motivo=f'Esquineros: {pedido.libro.titulo}'
                    )
                    movimientos.append(mov)

        return movimientos