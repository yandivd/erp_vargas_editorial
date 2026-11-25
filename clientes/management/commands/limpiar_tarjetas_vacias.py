from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef, Q

from clientes.models import EventoFidelidad, TarjetaFidelidad
from pedidos.models import Pedido


class Command(BaseCommand):
    help = 'Elimina tarjetas de fidelidad sin sellos, bono ni movimientos.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        eventos = EventoFidelidad.objects.filter(tarjeta_id=OuterRef('pk'))
        pedidos = Pedido.objects.filter(cliente_id=OuterRef('cliente_id')).filter(
            Q(sellos_fidelidad_otorgados=True) | Q(bono_fidelidad_aplicado__gt=0)
        )
        vacias = TarjetaFidelidad.objects.filter(
            sellos=0,
            bono_saldo=Decimal('0'),
            fecha_ultima_compra__isnull=True,
        ).filter(~Exists(eventos), ~Exists(pedidos))

        cantidad = vacias.count()
        nombres = list(vacias.values_list('cliente__nombre', flat=True)[:20])

        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING(
                    f'Tarjetas vacías encontradas: {cantidad}. '
                    f'Ejemplos: {", ".join(nombres) if nombres else "-"}'
                )
            )
            return

        total, _ = vacias.delete()
        self.stdout.write(
            self.style.SUCCESS(f'Tarjetas vacías eliminadas: {total}.')
        )
