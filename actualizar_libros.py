import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from pedidos.models import Book

def actualizar_libros():
    print("Cargando datos del archivo JSON...")
    
    try:
        with open('books.json', 'r', encoding='utf-8') as f:
            books_data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: No se encontró el archivo 'books.json' en la raíz del proyecto.")
        return

    actualizados = 0
    no_encontrados = 0

    for b in books_data:
        titulo_viejo = b.get('title', '').strip()
        paginas_reales = b.get('no_pag', 0)
        precio_real = b.get('price', 0)

        # Buscamos el libro en el nuevo ERP por su título
        # Usamos __iexact para que no importen las mayúsculas/minúsculas
        try:
            libro = Book.objects.get(titulo__iexact=titulo_viejo)
            
            # Actualizamos los datos
            libro.paginas = paginas_reales
            libro.precio = precio_real
            libro.save()
            
            print(f"  ✅ {titulo_viejo}: {paginas_reales} págs | ${precio_real}")
            actualizados += 1
            
        except Book.DoesNotExist:
            print(f"  ⚠️ No encontrado en el ERP: {titulo_viejo}")
            no_encontrados += 1
        except Book.MultipleObjectsReturned:
            print(f"  ⚠️ Hay más de un libro con el nombre: {titulo_viejo} (Omitido)")

    print("\n" + "="*40)
    print(f"Libros actualizados con éxito: {actualizados}")
    print(f"Libros no encontrados: {no_encontrados}")
    print("="*40)

if __name__ == '__main__':
    actualizar_libros()