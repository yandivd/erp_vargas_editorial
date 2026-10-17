from decimal import Decimal
from .models import Material, MovimientoInventario


class ServicioInventario:
    """
    Maneja los movimientos de entrada y salida de inventario.
    """
    
    @staticmethod
    def registrar_compra(material, cantidad, costo_unitario, proveedor=None, motivo=''):
        """Registra una compra: entrada al inventario."""
        return MovimientoInventario.objects.create(
            material=material,
            tipo='ENTRADA',
            cantidad=cantidad,
            costo_unitario=costo_unitario,
            proveedor=proveedor,
            motivo=motivo or f'Compra de {material.nombre}'
        )
    
    @staticmethod
    def registrar_consumo(material, cantidad, pedido, motivo=''):
        """Registra una salida por uso en producción."""
        return MovimientoInventario.objects.create(
            material=material,
            tipo='SALIDA',
            cantidad=cantidad,
            costo_unitario=material.costo_promedio,
            pedido=pedido,
            motivo=motivo or f'Consumo en pedido #{pedido.id}'
        )
    
    @staticmethod
    def consumir_materiales_pedido(pedido):
        """
        Descuenta automáticamente los materiales que necesita un pedido.
        Se llama cuando el pedido pasa a estado 'Impreso' (o el que definas).
        """
        from pedidos.services import CosteadorPedido
        
        costo = CosteadorPedido(pedido).calcular()
        movimientos = []
        
        # Hojas
        material_hojas = Material.objects.filter(nombre__iexact='hojas', activo=True).first()
        if material_hojas and costo['hojas'] > 0:
            mov = ServicioInventario.registrar_consumo(
                material_hojas, costo['hojas'], pedido,
                motivo=f'Impresión de {pedido.titulo_libro}'
            )
            movimientos.append(mov)
        
        # Tinta (en ml)
        material_tinta = Material.objects.filter(nombre__iexact='tinta', activo=True).first()
        if material_tinta:
            # Calcular ml consumidos según el rendimiento
            from core.models import Parametro
            rinde = Decimal(str(Parametro.get('rinde_tinta_paginas', 35000)))
            ml_por_pagina = Decimal('1000') / rinde if rinde else 0
            ml_consumidos = Decimal(pedido.paginas) * ml_por_pagina
            if ml_consumidos > 0:
                mov = ServicioInventario.registrar_consumo(
                    material_tinta, ml_consumidos, pedido,
                    motivo=f'Tinta para {pedido.titulo_libro}'
                )
                movimientos.append(mov)
        
        # Pegamento (en pomos)
        material_pegamento = Material.objects.filter(nombre__iexact='pegamento', activo=True).first()
        if material_pegamento:
            from core.models import Parametro
            rinde = Decimal(str(Parametro.get('rinde_pegamento_lomos', 70)))
            pomos_por_lomo = Decimal('1') / rinde if rinde else 0
            if pomos_por_lomo > 0:
                mov = ServicioInventario.registrar_consumo(
                    material_pegamento, pomos_por_lomo, pedido,
                    motivo=f'Pegamento para {pedido.titulo_libro}'
                )
                movimientos.append(mov)
        
        # Scotch (opcional)
        if pedido.lleva_scotch:
            material_scotch = Material.objects.filter(nombre__iexact='scotch', activo=True).first()
            if material_scotch:
                from core.models import Parametro
                rinde = Decimal(str(Parametro.get('rinde_scotch_libros', 30)))
                rollos_por_libro = Decimal('1') / rinde if rinde else 0
                if rollos_por_libro > 0:
                    mov = ServicioInventario.registrar_consumo(
                        material_scotch, rollos_por_libro, pedido,
                        motivo=f'Scotch para {pedido.titulo_libro}'
                    )
                    movimientos.append(mov)
        
        return movimientos