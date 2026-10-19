import os
import django

# Configuramos el entorno de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from pedidos.models import Pedido
from decimal import Decimal

def limpiar_montos():
    print("Iniciando limpieza de montos en los pedidos...")
    
    # Obtener todos los pedidos
    pedidos = Pedido.objects.all()
    total_pedidos = pedidos.count()
    
    if total_pedidos == 0:
        print("No hay pedidos en la base de datos.")
        return

    print(f"Se encontraron {total_pedidos} pedidos. Aplicando cambios...")

    # Actualizamos masivamente para que sea rápido
    # Usamos update() para no tener que guardar uno por uno
    actualizados = pedidos.update(
        anticipo_recibido=Decimal('0.00'),
        saldo_pendiente=Decimal('0.00')
    )

    print("\n" + "="*40)
    print(f"¡Limpieza completada!")
    print(f"Pedidos actualizados a $0.00 de anticipo y saldo: {actualizados}")
    print("="*40)

if __name__ == '__main__':
    limpiar_montos()