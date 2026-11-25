from .models import Material, MovimientoInventario


class ServicioInventario:
    """
    Maneja los movimientos de entrada y salida de inventario.
    """
    @staticmethod
    def registrar_compra(material, cantidad, costo_unitario, proveedor=None, motivo='', usuario=None):
        mov = MovimientoInventario.objects.create(
            material=material,
            tipo='ENTRADA',
            cantidad=cantidad,
            costo_unitario=costo_unitario,
            proveedor=proveedor,
            motivo=motivo or f'Compra de {material.nombre}',
            usuario=usuario,
        )
        
        return mov

    @staticmethod
    def registrar_consumo(material, cantidad, pedido=None, motivo='', usuario=None):
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
            motivo=motivo or (f'Consumo en pedido #{pedido.id}' if pedido else 'Salida manual'),
            usuario=usuario,
        )
    
    @staticmethod
    def consumir_materiales_pedido(pedido, momento=None):
        """Consume esquineros al entregar si el pedido los lleva o tiene cantos tintados.
        
        Los cantos tintados incluyen esquineros. Hojas, tinta y pegamento se
        controlan manualmente.
        """
        from core.models import Parametro
        from decimal import Decimal

        movimientos = []

        # Solo esquineros, y solo en el momento de entrega
        if momento in (None, 'ENTREGA', 'ESQUINEROS'):
            if pedido.lleva_esquineros or pedido.lleva_cantos_tintados:
                material_esq = Material.objects.filter(nombre__iexact='esquineros', activo=True).first()
                if material_esq:
                    cant_esq = Decimal(str(Parametro.get('esquineros_por_libro', 4)))
                    mov = ServicioInventario.registrar_consumo(
                        material_esq, cant_esq, pedido,
                        motivo=f'Esquineros: {pedido.libro.titulo}'
                    )
                    movimientos.append(mov)

        return movimientos