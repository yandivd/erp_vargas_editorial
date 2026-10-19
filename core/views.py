from django.shortcuts import render
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json

from finanzas.services_depreciacion import ServicioDepreciacion
from pedidos.models import Pedido, Estado, ServicioExterno
from clientes.models import Cliente
from inventario.models import Material, LoteConsumo
from finanzas.models import ActivoFijo, Depreciacion, MovimientoCaja, GastoOperativo
from finanzas.services import ServicioFinanzas


def dashboard(request):
    hoy = timezone.now().date()
    
    # --- FECHA DE CORTE PARA EMPEZAR A MEDIR DE CERO ---
    # Cambia esta fecha por el día que quieras empezar a contar
    fecha_inicio_contabilidad = timezone.datetime(2026, 10, 19).date() 
    
    # Si estamos en el mismo mes de la fecha de corte, usamos esa fecha. 
    # Si ya pasó el mes, usamos el día 1 del mes actual.
    if hoy.year == fecha_inicio_contabilidad.year and hoy.month == fecha_inicio_contabilidad.month:
        inicio_mes = fecha_inicio_contabilidad
    else:
        inicio_mes = hoy.replace(day=1)
    
    # ==========================================
    # AUTOMATIZACIÓN DE LA DEPRECIACIÓN
    # ==========================================
    # Si hay activos y NO existe una depreciación para el primer día de este mes:
    if ActivoFijo.objects.filter(activo=True).exists():
        if not Depreciacion.objects.filter(mes=inicio_mes).exists():
            ServicioDepreciacion.depreciar_mes(hoy.year, hoy.month)
    
    # ==========================================
    # 1. KPIs PRINCIPALES
    # ==========================================
    saldo_caja = ServicioFinanzas.saldo_caja()
    
    # Pedidos activos (excluyendo borradores, entregados y cancelados)
    estados_inactivos = Estado.objects.filter(nombre__in=['Borrador', 'Entregado', 'Cancelado']).values_list('id', flat=True)
    pedidos_activos = Pedido.objects.exclude(estado_id__in=estados_inactivos)
    
    pedidos_pendientes = pedidos_activos.count()
    por_cobrar = pedidos_activos.aggregate(t=Sum('saldo_pendiente'))['t'] or 0
    
    # Deuda a proveedores (Servicios externos no pagados)
    por_pagar = ServicioExterno.objects.filter(estado__in=['SOLICITADO', 'RECIBIDO']).aggregate(t=Sum('monto'))['t'] or 0

    # ==========================================
    # 2. DATOS PARA EL GRÁFICO (Ventas vs Costos del Mes)
    # ==========================================
    # Ingresos por ventas entregadas este mes
    ventas_mes = Pedido.objects.filter(
        estado__nombre='Entregado',
        fecha_entrega_real__date__gte=inicio_mes
    ).aggregate(t=Sum('precio_venta'))['t'] or 0

    # Costos de materiales de los libros entregados este mes
    # (Sumamos los movimientos de inventario asociados a esos pedidos)
    pedidos_entregados_mes = Pedido.objects.filter(estado__nombre='Entregado', fecha_entrega_real__date__gte=inicio_mes)
    costo_materiales_mes = 0
    for p in pedidos_entregados_mes:
        movs = p.movimientos_inventario.filter(tipo='SALIDA')
        costo_materiales_mes += sum(m.costo_total for m in movs)

    # Servicios externos (portadas/encuadernado) del mes
    costo_servicios_mes = ServicioExterno.objects.filter(
        pedido__in=pedidos_entregados_mes
    ).aggregate(t=Sum('monto'))['t'] or 0

    # ==========================================
    # 3. PEDIDOS POR ESTADO (Para las barras de progreso)
    # ==========================================
    pedidos_por_estado = pedidos_activos.values('estado__nombre', 'estado__color').annotate(total=Count('id')).order_by('estado__orden')
    total_activos = pedidos_activos.count()

    # ==========================================
    # 4. ALERTAS Y PENDIENTES
    # ==========================================
    pedidos_atrasados = [p for p in pedidos_activos if p.esta_atrasado]
    materiales_bajos = [m for m in Material.objects.filter(activo=True) if m.stock_bajo]
    
    estado_borrador = Estado.objects.filter(nombre='Borrador').first()
    borradores = Pedido.objects.filter(estado=estado_borrador).order_by('-fecha_pedido')[:5] if estado_borrador else []

    context = {
        'saldo_caja': saldo_caja,
        'pedidos_pendientes': pedidos_pendientes,
        'por_cobrar': por_cobrar,
        'por_pagar': por_pagar,
        'ventas_mes': ventas_mes,
        'costo_materiales_mes': costo_materiales_mes,
        'costo_servicios_mes': costo_servicios_mes,
        'ganancia_bruta_mes': ventas_mes - costo_materiales_mes - costo_servicios_mes,
        'pedidos_por_estado': pedidos_por_estado,
        'total_activos': total_activos,
        'pedidos_atrasados': pedidos_atrasados,
        'materiales_bajos': materiales_bajos,
        'borradores': borradores,
        'total_clientes': Cliente.objects.count(),
    }

    # Últimos 10 pedidos para la tabla
    pedidos_recientes = Pedido.objects.all().select_related('cliente', 'libro', 'estado').order_by('-fecha_pedido')[:10]
    
    # (Agrega esto al diccionario context)
    context['pedidos_recientes'] = pedidos_recientes
    
    return render(request, 'dashboard.html', context)