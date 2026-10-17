from django.shortcuts import render
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from pedidos.models import Pedido, Estado
from clientes.models import Cliente
from inventario.models import Material
from finanzas.services import ServicioFinanzas


def dashboard(request):
    hoy = timezone.now().date()
    hace_30_dias = hoy - timedelta(days=30)
    
    # 1. Buscamos los estados especiales
    estado_borrador = Estado.objects.filter(nombre='Borrador').first()
    estado_entregado = Estado.objects.filter(nombre='Entregado').first()
    estado_cancelado = Estado.objects.filter(nombre='Cancelado').first()
    
    # 2. Pedidos activos: todos los que NO sean borrador, entregado o cancelado
    estados_excluidos = []
    if estado_borrador: estados_excluidos.append(estado_borrador.id)
    if estado_entregado: estados_excluidos.append(estado_entregado.id)
    if estado_cancelado: estados_excluidos.append(estado_cancelado.id)
    
    pedidos_activos = Pedido.objects.exclude(estado_id__in=estados_excluidos)
    
    # Pedidos agrupados por estado
    pedidos_por_estado = pedidos_activos.values('estado__nombre', 'estado__color').annotate(total=Count('id'))
    
    # KPIs
    pedidos_mes = Pedido.objects.filter(fecha_pedido__date__gte=hace_30_dias).count()
    pedidos_pendientes = pedidos_activos.count()
    pedidos_atrasados = [p for p in pedidos_activos if p.esta_atrasado]
    
    # Finanzas
    saldo_caja = ServicioFinanzas.saldo_caja()
    por_cobrar = pedidos_activos.aggregate(t=Sum('saldo_pendiente'))['t'] or 0
    
    # Materiales
    materiales_bajos = [m for m in Material.objects.filter(activo=True) if m.stock_bajo]
    
    # Borradores sin confirmar
    borradores = Pedido.objects.filter(estado=estado_borrador).order_by('-fecha_pedido') if estado_borrador else []
    
    context = {
        'pedidos_por_estado': pedidos_por_estado,
        'pedidos_mes': pedidos_mes,
        'pedidos_pendientes': pedidos_pendientes,
        'pedidos_atrasados': pedidos_atrasados[:5],
        'saldo_caja': saldo_caja,
        'por_cobrar': por_cobrar,
        'materiales_bajos': materiales_bajos,
        'total_clientes': Cliente.objects.count(),
        'borradores': borradores,
        'total_borradores': len(borradores),
    }
    return render(request, 'dashboard.html', context)