import os
import django

# Configuramos el entorno de Django para que el script pueda correr solo
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from django.utils import timezone
from django.db import transaction

from inventario.models import Material, LoteConsumo, MovimientoInventario
from finanzas.models import MovimientoCaja
from pedidos.models import Pedido, Book, HistorialEstado, ServicioExterno
from clientes.models import Cliente

def inicializar():
    print("Iniciando limpieza de base de datos...")
    
    with transaction.atomic():
        # 1. Limpiamos los datos de prueba
        Pedido.objects.all().delete()
        Book.objects.all().delete()
        Cliente.objects.all().delete()
        MovimientoCaja.objects.all().delete()
        MovimientoInventario.objects.all().delete()
        LoteConsumo.objects.all().delete()
        Material.objects.all().delete()
        print("Datos de prueba eliminados.")

        # 2. Creamos los materiales con sus costos reales
        hojas = Material.objects.create(nombre='Hojas', unidad_medida='paquete', unidad_consumo='Paquete', cantidad_por_unidad=1, costo_promedio=Decimal('1055.56'), stock_actual=18, stock_consumo=18)
        tinta = Material.objects.create(nombre='Tinta', unidad_medida='litro', unidad_consumo='Pomo 65ml', cantidad_por_unidad=Decimal('15.38'), costo_promedio=Decimal('17500.00'), stock_actual=Decimal('0.870'), stock_consumo=13.38) # 15.38 - 2 usados
        pegamento = Material.objects.create(nombre='Pegamento', unidad_medida='pomo', unidad_consumo='Pomo', cantidad_por_unidad=1, costo_promedio=Decimal('5000.00'), stock_actual=3, stock_consumo=3)
        esquineros = Material.objects.create(nombre='Esquineros', unidad_medida='unidad', unidad_consumo='Unidad', cantidad_por_unidad=1, costo_promedio=Decimal('500.00'), stock_actual=139, stock_consumo=139)
        scotch = Material.objects.create(nombre='Scotch', unidad_medida='rollo', unidad_consumo='Rollo', cantidad_por_unidad=1, costo_promedio=Decimal('1000.00'), stock_actual=1, stock_consumo=1)
        print("Materiales creados con sus stocks reales.")

        # 3. Creamos los Lotes de Consumo (El almacén físico)
        # Hojas (18 lotes de 1 paquete)
        for i in range(1, 19):
            LoteConsumo.objects.create(material=hojas, codigo=f"HOJA-{i:03d}", cantidad_inicial=1, cantidad_actual=1, costo_total=Decimal('1055.56'), estado='CERRADO')
        
        # Tinta (Creamos los 15 lotes, pero marcamos los primeros 2 como EN_USO)
        for i in range(1, 16):
            estado_lote = 'EN_USO' if i <= 2 else 'CERRADO'
            fecha = timezone.now() if i <= 2 else None
            LoteConsumo.objects.create(material=tinta, codigo=f"TINT-{i:03d}", cantidad_inicial=1, cantidad_actual=1, costo_total=Decimal('1137.50'), estado=estado_lote, fecha_apertura=fecha)

        # Pegamento (3 lotes)
        for i in range(1, 4):
            LoteConsumo.objects.create(material=pegamento, codigo=f"PEGM-{i:03d}", cantidad_inicial=1, cantidad_actual=1, costo_total=Decimal('5000.00'), estado='CERRADO')

        # Scotch (1 lote)
        LoteConsumo.objects.create(material=scotch, codigo="SCOT-001", cantidad_inicial=1, cantidad_actual=1, costo_total=Decimal('1000.00'), estado='CERRADO')
        print("Lotes de almacén creados.")

        # 4. Registramos el dinero inicial en Caja
        # Para que la caja cuadre, registramos un "Saldo Inicial" como ingreso.
        MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='OTRO', # Usamos la categoría OTRO o puedes crear una llamada SALDO_INICIAL
            monto=Decimal('75217.00'),
            concepto='Saldo inicial de caja (Capital de trabajo)',
            metodo='EFECTIVO'
        )
        print("Dinero en caja inicializado: $75,217.00")

        # 5. Registramos la merma de los 2 pomos de tinta usados (para que el gasto quede contable)
        # Esto refleja el dinero que ya salió de la caja en el pasado para usar esa tinta
        for i in range(2):
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='GASTO_OPERATIVO',
                monto=Decimal('1137.50'),
                concepto='Apertura de lote TINT-00' + str(i+1) + ' (Tinta)',
                metodo='EFECTIVO'
            )
        print("Gasto de los 2 pomos de tinta usados registrado.")

    print("\n¡Base de datos inicializada con éxito!")

if __name__ == '__main__':
    inicializar()