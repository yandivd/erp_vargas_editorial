import os
import django
import pandas as pd
import warnings
from datetime import datetime

# Ocultamos los warnings de fechas para que la consola no se sature
warnings.filterwarnings("ignore", category=RuntimeWarning)

# Configuramos Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from clientes.models import Cliente
from pedidos.models import Book, Pedido, Estado

def migrar():
    print("Iniciando migración de pedidos históricos...")
    
    try:
        df = pd.read_excel('pedidos(2).xlsx')
    except FileNotFoundError:
        print("❌ Error: No se encontró el archivo 'pedidos(2).xlsx' en la raíz.")
        return

    mapeo_estados = {
        'Entregado': 'Entregado',
        'Listo para Entregar': 'Listo para Entregar',
        'Pendiente a Caratula': 'Pendiente a Carátula',
        'Pegado': 'Pegado',
        'Impreso': 'Impreso'
    }

    creados = 0
    libros_creados = 0
    clientes_creados = 0
    omitidos = 0

    for index, row in df.iterrows():
        try:
            titulo = str(row['Libro']).strip()
            nombre_cliente = str(row['Cliente']).strip()
            
            if nombre_cliente.lower() in ['tienda', 'proveedor portadas', 'sorteo', 'nan']:
                omitidos += 1
                continue

            telefono = str(row['Teléfono']).strip() if pd.notna(row['Teléfono']) else '00000000'
            telefono_limpio = telefono.replace(' ', '').replace('+53', '').strip()
            if len(telefono_limpio) < 5: 
                telefono_limpio = '00000000'
            
            # Convertimos las fechas a "aware" (con zona horaria) para que Django no se queje
            fecha_orden_naive = pd.to_datetime(row['Fecha de Orden']).to_pydatetime()
            fecha_orden = timezone.make_aware(fecha_orden_naive)
            
            estado_excel = str(row['Estado']).strip()
            nombre_estado_erp = mapeo_estados.get(estado_excel, 'Borrador')
            estado_erp = Estado.objects.get(nombre=nombre_estado_erp)

            # 1. Buscar o Crear Cliente
            cliente, c_creado = Cliente.objects.get_or_create(
                telefono=telefono_limpio,
                defaults={'nombre': nombre_cliente}
            )
            if c_creado:
                clientes_creados += 1

            # 2. Buscar o Crear Libro
            libro, l_creado = Book.objects.get_or_create(
                titulo=titulo,
                defaults={'paginas': 200, 'precio': 5000} 
            )
            if l_creado:
                libros_creados += 1

            # 3. Crear el Pedido
            existe = Pedido.objects.filter(
                cliente=cliente, 
                libro=libro, 
                fecha_pedido__date=fecha_orden.date()
            ).exists()

            if not existe:
                if nombre_estado_erp == 'Entregado':
                    if pd.notna(row['Fecha de Entrega']):
                        fecha_real_naive = pd.to_datetime(row['Fecha de Entrega']).to_pydatetime()
                    else:
                        fecha_real_naive = pd.to_datetime(row['Fecha Estimada']).to_pydatetime()
                    fecha_entrega_real = timezone.make_aware(fecha_real_naive)
                    anticipo = libro.precio
                    fecha_estimada = None
                else:
                    fecha_entrega_real = None
                    anticipo = libro.precio / 2
                    fecha_estimada = pd.to_datetime(row['Fecha Estimada']).date()

                pedido = Pedido.objects.create(
                    cliente=cliente,
                    libro=libro,
                    cantidad=1,
                    precio_venta=libro.precio,
                    anticipo_recibido=anticipo,
                    saldo_pendiente=libro.precio - anticipo,
                    estado=estado_erp,
                    fecha_entrega_prometida=fecha_estimada,
                    fecha_entrega_real=fecha_entrega_real,
                    notas="Pedido histórico migrado",
                    referencia_externa=f"EXCEL-{index + 2}" # <-- Guardamos el número de fila
                )
                # Forzamos la fecha original
                Pedido.objects.filter(id=pedido.id).update(fecha_pedido=fecha_orden)
                creados += 1

        except Exception as e:
            print(f"⚠️ Error en fila {index} ({titulo}): {e}")

    print("\n" + "="*40)
    print("¡MIGRACIÓN COMPLETADA!")
    print(f"Clientes nuevos: {clientes_creados}")
    print(f"Libros nuevos: {libros_creados}")
    print(f"Pedidos migrados: {creados}")
    print(f"Omitidos (Tienda/Proveedores): {omitidos}")
    print("="*40)

if __name__ == '__main__':
    migrar()