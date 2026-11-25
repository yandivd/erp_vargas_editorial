from django.core.management.base import BaseCommand
from django.db import transaction
from pedidos.models import Book, Pedido
from pedidos.services import CosteadorPedido, precio_usd_recomendado


class Command(BaseCommand):
    help = 'Actualiza el precio USD recomendado de todos los libros'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los cambios sin guardarlos en la base de datos',
        )
        parser.add_argument(
            '--solo-usd',
            action='store_true',
            help='Actualiza solo precio_usd y deja intacto el precio CUP legacy',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        solo_usd = options['solo_usd']
        libros = Book.objects.all()

        self.stdout.write(
            self.style.SUCCESS(
                f"Encontrados {libros.count()} libros para procesar..."
            )
        )

        actualizados = 0
        sin_cambios = 0
        errores = 0

        with transaction.atomic():
            for libro in libros:
                try:
                    pedido_falso = Pedido(
                        libro=libro,
                        cantidad=1,
                        lleva_cantos_tintados=False,
                        lleva_esquineros=False,
                        precio_venta=0,
                    )
                    costeador = CosteadorPedido(pedido_falso)
                    precio_cup_nuevo = costeador.calcular_precio_sugerido()
                    precio_usd_nuevo = precio_usd_recomendado(precio_cup_nuevo)

                    cambios = {}
                    if libro.precio_usd != precio_usd_nuevo:
                        cambios['precio_usd'] = precio_usd_nuevo
                    if not solo_usd and libro.precio != precio_cup_nuevo:
                        cambios['precio'] = precio_cup_nuevo

                    if not cambios:
                        sin_cambios += 1
                        continue

                    mensaje = ', '.join(
                        f"{campo}: {getattr(libro, campo)} -> {valor}"
                        for campo, valor in cambios.items()
                    )

                    if dry_run:
                        self.stdout.write(
                            self.style.WARNING(f"[DRY RUN] {libro.titulo}: {mensaje}")
                        )
                    else:
                        for campo, valor in cambios.items():
                            setattr(libro, campo, valor)
                        libro.save(update_fields=list(cambios))
                        self.stdout.write(
                            self.style.SUCCESS(f"Actualizado: {libro.titulo}: {mensaje}")
                        )

                    actualizados += 1
                except Exception as e:
                    errores += 1
                    self.stdout.write(
                        self.style.ERROR(f"Error con '{libro.titulo}': {e}")
                    )

        self.stdout.write(self.style.SUCCESS("\n=== RESUMEN ==="))
        self.stdout.write(f"Actualizados: {actualizados}")
        self.stdout.write(f"Sin cambios: {sin_cambios}")
        self.stdout.write(f"Errores: {errores}")
