from django.core.management.base import BaseCommand
from django.db import transaction
from pedidos.models import Book, Pedido, Estado
from pedidos.services import CosteadorPedido

class Command(BaseCommand):
    help = 'Actualiza el precio de todos los libros basándose en el precio recomendado'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los cambios sin guardarlos en la base de datos',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        libros = Book.objects.all()
        
        # Obtenemos el primer estado para usarlo en el pedido falso
        estado_inicial = Estado.objects.first()
        if not estado_inicial:
            self.stdout.write(self.style.ERROR("No hay estados creados. Crea al menos uno para usar este comando."))
            return

        self.stdout.write(self.style.SUCCESS(f"Encontrados {libros.count()} libros para procesar..."))
        
        actualizados = 0
        sin_cambios = 0
        errores = 0

        with transaction.atomic():
            for libro in libros:
                try:
                    # 1. Pedido falso
                    pedido_falso = Pedido(
                        libro=libro,
                        cantidad=1,
                        lleva_scotch=False,
                        lleva_esquineros=False,
                        estado=estado_inicial,
                    )
                    
                    # 2. Costeador
                    costeador = CosteadorPedido(pedido_falso)
                    
                    # 3. Llamamos al método que descubrimos
                    nuevo_precio = costeador.calcular_precio_sugerido()
                    
                    if nuevo_precio and float(nuevo_precio) != float(libro.precio):
                        mensaje = f"{libro.titulo}: ${libro.precio} -> ${nuevo_precio}"
                        
                        if dry_run:
                            self.stdout.write(self.style.WARNING(f"[DRY RUN] {mensaje}"))
                        else:
                            libro.precio = nuevo_precio
                            libro.save(update_fields=['precio'])
                            self.stdout.write(self.style.SUCCESS(f"Actualizado: {mensaje}"))
                        
                        actualizados += 1
                    else:
                        sin_cambios += 1
                        
                except Exception as e:
                    errores += 1
                    self.stdout.write(self.style.ERROR(f"Error con '{libro.titulo}': {e}"))

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS("\n=== RESUMEN ==="))
        self.stdout.write(f"Actualizados: {actualizados}")
        self.stdout.write(f"Sin cambios: {sin_cambios}")
        self.stdout.write(f"Errores: {errores}")