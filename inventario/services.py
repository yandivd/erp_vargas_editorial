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
    def consumir_materiales_pedido(pedido, momento=None):
        """Descuenta los materiales según la etapa del pedido, aplicando % de merma."""
        from pedidos.services import CosteadorPedido
        from core.models import Parametro
        import math

        costo = CosteadorPedido(pedido).calcular()
        movimientos = []

        # Factor de merma (5% por defecto)
        merma = float(Parametro.get('factor_merma', 0.05))

        # ==========================================
        # IMPRESIÓN: hojas y tinta
        # ==========================================
        if momento in (None, 'IMPRESION'):
            # --- HOJAS ---
            material_hojas = Material.objects.filter(nombre__iexact='hojas', activo=True).first()
            if material_hojas and costo['hojas'] > 0:
                hojas_con_merma = math.ceil(costo['hojas'] * (1 + merma))
                mov = ServicioInventario.registrar_consumo(
                    material_hojas, hojas_con_merma, pedido,
                    motivo=f'Impresión: {pedido.libro.titulo} (+{int(merma*100)}% merma)'
                )
                movimientos.append(mov)

            # --- TINTA ---
            material_tinta = Material.objects.filter(nombre__iexact='tinta', activo=True).first()
            if material_tinta:
                rinde = Decimal(str(Parametro.get('rinde_tinta_paginas', 35000)))
                ml_por_pagina = Decimal('1000') / rinde if rinde else 0
                ml_consumidos = Decimal(pedido.paginas) * ml_por_pagina
                ml_con_merma = ml_consumidos * Decimal(str(1 + merma))

                if ml_con_merma > 0:
                    mov = ServicioInventario.registrar_consumo(
                        material_tinta, ml_con_merma, pedido,
                        motivo=f'Tinta: {pedido.libro.titulo} (+{int(merma*100)}% merma)'
                    )
                    movimientos.append(mov)

        # ==========================================
        # PEGADO / EMPAQUE: pegamento y scotch
        # ==========================================
        if momento in (None, 'PEGADO', 'EMPAQUE'):
            # --- PEGAMENTO ---
            material_pegamento = Material.objects.filter(nombre__iexact='pegamento', activo=True).first()
            if material_pegamento:
                rinde = Decimal(str(Parametro.get('rinde_pegamento_lomos', 70)))
                pomos_por_lomo = Decimal('1') / rinde if rinde else 0
                pomos_con_merma = pomos_por_lomo * Decimal(str(1 + merma))

                if pomos_con_merma > 0:
                    mov = ServicioInventario.registrar_consumo(
                        material_pegamento, pomos_con_merma, pedido,
                        motivo=f'Pegamento: {pedido.libro.titulo} (+{int(merma*100)}% merma)'
                    )
                    movimientos.append(mov)

            # --- SCOTCH (opcional, sin merma) ---
            if pedido.lleva_scotch:
                material_scotch = Material.objects.filter(nombre__iexact='scotch', activo=True).first()
                if material_scotch:
                    rinde = Decimal(str(Parametro.get('rinde_scotch_libros', 30)))
                    rollos_por_libro = Decimal('1') / rinde if rinde else 0
                    if rollos_por_libro > 0:
                        mov = ServicioInventario.registrar_consumo(
                            material_scotch, rollos_por_libro, pedido,
                            motivo=f'Scotch: {pedido.libro.titulo}'
                        )
                        movimientos.append(mov)

        # ==========================================
        # ENTREGA: esquineros (si lleva)
        # ==========================================
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