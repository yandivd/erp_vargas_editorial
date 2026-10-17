from django.shortcuts import render
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from pedidos.models import Pedido
from clientes.models import Cliente
from inventario.models import Material
from finanzas.models import MovimientoCaja, ActivoFijo
from finanzas.services import ServicioFinanzas


def dashboard(request):
    hoy = timezone.now().date()
    hace_30_dias = hoy - timedelta(days=30)
    
    # Pedidos por estado
    # Los "activos" son los que ya están confirmados y en producción
    pedidos_activos = Pedido.objects.exclude(estado__in=['Borrador', 'Entregado', 'Cancelado'])
    pedidos_por_estado = pedidos_activos.values('estado').annotate(total=Count('id'))
    
    # KPIs
    pedidos_mes = Pedido.objects.filter(fecha_pedido__date__gte=hace_30_dias).count()
    pedidos_pendientes = pedidos_activos.count()
    pedidos_atrasados = [p for p in pedidos_activos if p.esta_atrasado]
    
    # Finanzas
    saldo_caja = ServicioFinanzas.saldo_caja()
    
    # Cuentas por cobrar (saldo pendiente de pedidos no entregados)
    por_cobrar = pedidos_activos.aggregate(t=Sum('saldo_pendiente'))['t'] or 0
    
    # Materiales con stock bajo
    materiales_bajos = [m for m in Material.objects.filter(activo=True) if m.stock_bajo]

    # Borradores sin confirmar
    borradores = Pedido.objects.filter(estado='Borrador').order_by('-fecha_pedido')
    
    context = {
        'pedidos_por_estado': pedidos_por_estado,
        'pedidos_mes': pedidos_mes,
        'pedidos_pendientes': pedidos_pendientes,
        'pedidos_atrasados': pedidos_atrasados[:5],
        'saldo_caja': saldo_caja,
        'por_cobrar': por_cobrar,
        'materiales_bajos': materiales_bajos,
        'total_clientes': Cliente.objects.count(),
        'borradores': borradores,           # <-- nuevo
        'total_borradores': borradores.count(),  # <-- nuevo
    }
    return render(request, 'dashboard.html', context)