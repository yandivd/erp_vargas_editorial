from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from pedidos.models import Book


class ActualizarPreciosCommandTests(TestCase):
    def test_actualiza_precio_usd_recomendado(self):
        libro = Book.objects.create(
            titulo='Libro de prueba',
            paginas=100,
            precio=Decimal('0'),
            precio_usd=Decimal('0'),
        )

        with patch(
            'pedidos.management.commands.actualizar_precios.CosteadorPedido.calcular_precio_sugerido',
            return_value=Decimal('1100'),
        ):
            call_command('actualizar_precios', stdout=StringIO())

        libro.refresh_from_db()
        self.assertEqual(libro.precio_usd, Decimal('1.2'))
        self.assertEqual(libro.precio, Decimal('1100'))

    def test_dry_run_no_guarda(self):
        libro = Book.objects.create(
            titulo='Libro sin cambios',
            paginas=100,
            precio=Decimal('0'),
            precio_usd=Decimal('0'),
        )

        with patch(
            'pedidos.management.commands.actualizar_precios.CosteadorPedido.calcular_precio_sugerido',
            return_value=Decimal('1100'),
        ):
            call_command('actualizar_precios', '--dry-run', stdout=StringIO())

        libro.refresh_from_db()
        self.assertEqual(libro.precio_usd, Decimal('0'))
        self.assertEqual(libro.precio, Decimal('0'))

    def test_solo_usd_no_toca_precio_legacy(self):
        libro = Book.objects.create(
            titulo='Libro solo USD',
            paginas=100,
            precio=Decimal('0'),
            precio_usd=Decimal('0'),
        )

        with patch(
            'pedidos.management.commands.actualizar_precios.CosteadorPedido.calcular_precio_sugerido',
            return_value=Decimal('1100'),
        ):
            call_command('actualizar_precios', '--solo-usd', stdout=StringIO())

        libro.refresh_from_db()
        self.assertEqual(libro.precio_usd, Decimal('1.2'))
        self.assertEqual(libro.precio, Decimal('0'))
