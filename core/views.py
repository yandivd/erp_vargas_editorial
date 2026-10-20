from django.shortcuts import render
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal
from collections import defaultdict

from pedidos.models import Pedido, Estado, Book, ServicioExterno
from clientes.models import Cliente
from inventario.models import Material, MovimientoInventario
from finanzas.models import MovimientoCaja, ActivoFijo, GastoOperativo
from finanzas.services import ServicioFinanzas


def dashboard(request):
    hoy = timezone.now().date()
    inicio_mes = hoy.replace(day=1)
    
    # --- KPIs PRINCIPALES ---
    saldo_caja_cup = ServicioFinanzas.saldo_caja('CUP')
    saldo_caja_usd = ServicioFinanzas.saldo_caja('USD')
    # Para la tarjeta principal, mostramos el CUP. Luego pasamos ambos al context.
    
    # Pedidos activos
    estados_inactivos = Estado.objects.filter(nombre__in=['Borrador', 'Entregado', 'Cancelado']).values_list('id', flat=True)
    pedidos_activos = Pedido.objects.exclude(estado_id__in=estados_inactivos)
    pedidos_pendientes = pedidos_activos.count()
    
    por_cobrar = pedidos_activos.aggregate(t=Sum('saldo_pendiente'))['t'] or 0
    por_pagar = ServicioExterno.objects.filter(estado__in=['SOLICITADO', 'RECIBIDO']).aggregate(t=Sum('monto'))['t'] or 0

    # --- ANÁLISIS FINANCIERO DEL MES (Ingresos y Gastos de Caja) ---
    movimientos_mes = MovimientoCaja.objects.filter(fecha__date__gte=inicio_mes)
    
    total_ingresos = movimientos_mes.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
    total_gastos = movimientos_mes.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
    saldo_mes = total_ingresos - total_gastos
    margen = (saldo_mes / total_ingresos * 100) if total_ingresos > 0 else 0

    # Desglose de Ingresos y Gastos por Categoría
    ingresos_por_cat = list(movimientos_mes.filter(tipo='INGRESO').values('categoria').annotate(total=Sum('monto')).order_by('-total'))
    gastos_por_cat = list(movimientos_mes.filter(tipo='EGRESO').values('categoria').annotate(total=Sum('monto')).order_by('-total'))

    # --- ANÁLISIS DE PEDIDOS (Top Libros y Clientes) ---
    pedidos_entregados = Pedido.objects.filter(estado__nombre='Entregado')
    top_libros = Book.objects.annotate(num_pedidos=Count('pedidos')).order_by('-num_pedidos')[:5]
    
    # Clientes VIP (más de 5 libros entregados)
    top_clientes = Cliente.objects.annotate(
        libros_comprados=Count('pedidos', filter=Q(pedidos__estado__nombre='Entregado'))
    ).filter(libros_comprados__gt=0).order_by('-libros_comprados')[:5]

    # Progreso de pedidos por estado
    pedidos_por_estado = pedidos_activos.values('estado__nombre', 'estado__color').annotate(total=Count('id')).order_by('estado__orden')
    total_activos = pedidos_activos.count()

    # Alertas
    pedidos_atrasados = [p for p in pedidos_activos if p.esta_atrasado]
    materiales_bajos = [m for m in Material.objects.filter(activo=True) if m.stock_bajo]
    estado_borrador = Estado.objects.filter(nombre='Borrador').first()
    borradores = Pedido.objects.filter(estado=estado_borrador).order_by('-fecha_pedido')[:5] if estado_borrador else []

    # --- PROYECCIÓN A 6 MESES ---
    # Promedio de los últimos 3 meses para proyectar
    hace_3_meses = hoy - timedelta(days=90)
    ingresos_3m = MovimientoCaja.objects.filter(tipo='INGRESO', fecha__date__gte=hace_3_meses).aggregate(t=Sum('monto'))['t'] or 0
    promedio_mensual = ingresos_3m / 3
    
    proyeccion = []
    for i in range(1, 7):
        mes_futuro = (hoy + timedelta(days=30*i)).strftime('%b %Y')
        proyeccion.append({'mes': mes_futuro, 'monto': float(promedio_mensual)})

    context = {
        'saldo_caja': saldo_caja_cup,
        'saldo_caja_usd': saldo_caja_usd,
        'pedidos_pendientes': pedidos_pendientes,
        'por_cobrar': por_cobrar,
        'por_pagar': por_pagar,
        'total_ingresos': total_ingresos,
        'total_gastos': total_gastos,
        'saldo_mes': saldo_mes,
        'margen': margen,
        'ingresos_por_cat': ingresos_por_cat,
        'gastos_por_cat': gastos_por_cat,
        'top_libros': top_libros,
        'top_clientes': top_clientes,
        'pedidos_por_estado': pedidos_por_estado,
        'total_activos': total_activos,
        'pedidos_atrasados': pedidos_atrasados,
        'materiales_bajos': materiales_bajos,
        'borradores': borradores,
        'proyeccion': proyeccion,
        'promedio_mensual': promedio_mensual,
    }
    
    return render(request, 'dashboard.html', context)