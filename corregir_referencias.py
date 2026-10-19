import os
import django
import json
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from pedidos.models import Pedido, Book
import warnings

warnings.filterwarnings("ignore", category=RuntimeWarning)

def arreglar_todo():
    print("Cargando datos de books.json y pedidos.json...")
    
    try:
        with open('books.json', 'r', encoding='utf-8') as f:
            books_data = json.load(f)
        with open('pedidos.json', 'r', encoding='utf-8') as f:
            pedidos_data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: Asegúrate de tener books.json y pedidos.json en la raíz.")
        return

    # 1. Creamos un diccionario de libros para buscar rápido el precio y las páginas reales
    # Estructura: { id_viejo_del_libro: {"titulo": ..., "precio": ..., "paginas": ...} }
    dict_libros = {}
    for b in books_data:
        dict_libros[b['id']] = {
            'titulo': b.get('title', '').strip(),
            'precio': b.get('price', 0),
            'paginas': b.get('no_pag', 0)
        }

    actualizados = 0
    no_encontrados = 0

    for p in pedidos_data:
        id_pedido_viejo = p.get('id')
        id_libro_viejo = p.get('libro_id')
        nombre_cliente = str(p.get('name', '')).strip()
        fecha_orden_str = p.get('fecha_orden')
        
        if not fecha_orden_str or not id_libro_viejo:
            continue
            
        fecha_orden = datetime.strptime(fecha_orden_str, '%Y-%m-%d').date()
        
        # Obtenemos los datos reales del libro desde books.json
        datos_libro = dict_libros.get(id_libro_viejo)
        if not datos_libro:
            continue

        titulo_libro_real = datos_libro['titulo']
        precio_real = datos_libro['precio']

        try:
            # Buscamos el pedido en el ERP usando el CLIENTE, la FECHA y el TÍTULO DEL LIBRO
            # Así evitamos confundir a Cinthia con sus dos pedidos del mismo día
            pedidos_candidatos = Pedido.objects.filter(
                cliente__nombre__iexact=nombre_cliente,
                fecha_pedido__date=fecha_orden,
                libro__titulo__iexact=titulo_libro_real
            )
            
            if pedidos_candidatos.count() == 0:
                print(f"  ⚠️ No encontrado: {nombre_cliente} - {titulo_libro_real}")
                no_encontrados += 1
                continue
                
            pedido = pedidos_candidatos.first()
            
            # 1. Asignamos la referencia correcta
            pedido.referencia_externa = str(id_pedido_viejo)
            
            # 2. Forzamos el precio de venta real (el de books.json)
            pedido.precio_venta = precio_real
            
            # 3. Si en el JSON viejo estaba totalmente pagado, el anticipo es el precio total
            # Si no, respetamos el anticipo que ya tiene registrado
            if p.get('totalmente_pagado') == 1:
                pedido.anticipo_recibido = precio_real
            
            pedido.save()
            actualizados += 1
            print(f"  ✅ {nombre_cliente} - {titulo_libro_real}: Ref {id_pedido_viejo} | Precio: ${precio_real}")
            
        except Exception as e:
            print(f"⚠️ Error con {nombre_cliente}: {e}")

    print("\n" + "="*40)
    print(f"Pedidos corregidos: {actualizados}")
    print(f"No encontrados: {no_encontrados}")
    print("="*40)

if __name__ == '__main__':
    arreglar_todo()