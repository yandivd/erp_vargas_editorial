from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clientes.models import Cliente, TarjetaFidelidad
from core.models import Parametro
from core.services import dashboard_fidelidad
from pedidos.models import Book, Estado, Pedido


class DashboardFidelidadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.estado = Estado.objects.create(nombre='Entregado', es_final=True)
        cls.libro = Book.objects.create(
            titulo='Libro de prueba',
            paginas=100,
            precio=Decimal('1000'),
        )
        cls.cliente_fiel = Cliente.objects.create(nombre='Cliente Fiel')
        cls.cliente_nuevo = Cliente.objects.create(nombre='Cliente Nuevo')
        cls.cliente_sin_tarjeta = Cliente.objects.create(
            nombre='Cliente Sin Tarjeta'
        )
        cls.tarjeta_fiel = TarjetaFidelidad.objects.create(
            cliente=cls.cliente_fiel,
            sellos=5,
            bono_saldo=Decimal('2500'),
            fecha_ultima_compra=timezone.now(),
        )
        cls.tarjeta_nueva = TarjetaFidelidad.objects.create(
            cliente=cls.cliente_nuevo,
            sellos=10,
            bono_saldo=Decimal('0'),
            fecha_ultima_compra=timezone.now(),
        )
        Pedido.objects.create(
            cliente=cls.cliente_fiel,
            libro=cls.libro,
            estado=cls.estado,
            cantidad=1,
            precio_venta=Decimal('1000'),
            bono_fidelidad_aplicado=Decimal('500'),
        )
        Pedido.objects.create(
            cliente=cls.cliente_sin_tarjeta,
            libro=cls.libro,
            estado=cls.estado,
            cantidad=1,
            precio_venta=Decimal('2000'),
        )

    def test_kpis_basicos(self):
        data = dashboard_fidelidad()
        kpis = data['kpis']

        self.assertEqual(kpis['total_clientes'], 3)
        self.assertEqual(kpis['tarjetas_total'], 2)
        self.assertEqual(kpis['adopcion_tarjeta'], 66.7)
        self.assertEqual(kpis['tarjetas_activas'], 2)
        self.assertEqual(kpis['tarjetas_completas'], 1)
        self.assertEqual(kpis['clientes_con_bono'], 1)
        self.assertEqual(kpis['bono_pendiente_total'], 2500.0)
        self.assertEqual(kpis['sellos_promedio'], 7.5)
        self.assertEqual(kpis['sellos_totales'], 15)
        self.assertEqual(kpis['pedidos_fidelizados'], 1)
        self.assertEqual(kpis['pedidos_no_fidelizados'], 1)
        self.assertEqual(kpis['ticket_medio_fidelizado'], 1000.0)
        self.assertEqual(kpis['ticket_medio_no_fidelizado'], 2000.0)
        self.assertEqual(kpis['ingresos_fidelizados'], 1000.0)
        self.assertEqual(kpis['ingresos_no_fidelizados'], 2000.0)
        self.assertEqual(kpis['bono_canjeado_total'], 500.0)
        self.assertEqual(kpis['pedidos_con_bono'], 1)

    def test_sin_datos_no_divide_por_cero(self):
        Pedido.objects.all().delete()
        TarjetaFidelidad.objects.all().delete()
        Cliente.objects.all().delete()

        data = dashboard_fidelidad()

        self.assertEqual(data['kpis']['total_clientes'], 0)
        self.assertEqual(data['kpis']['tarjetas_total'], 0)
        self.assertEqual(data['kpis']['adopcion_tarjeta'], 0)

    def test_riesgo_respeta_parametro(self):
        self.tarjeta_fiel.fecha_ultima_compra = timezone.now() - timedelta(days=25)
        self.tarjeta_fiel.sellos = 3
        self.tarjeta_fiel.save(update_fields=['fecha_ultima_compra', 'sellos'])

        Parametro.objects.update_or_create(
            clave='fidelidad_dias_expiracion',
            defaults={'valor': 30, 'descripcion': 'test'},
        )
        data = dashboard_fidelidad()
        self.assertEqual(data['kpis']['clientes_en_riesgo'], 1)
        self.assertEqual(
            data['clientes_riesgo_lista'][0]['urgencia'],
            'alta',
        )

        Parametro.objects.update_or_create(
            clave='fidelidad_dias_expiracion',
            defaults={'valor': 90, 'descripcion': 'test'},
        )
        data = dashboard_fidelidad()
        self.assertEqual(data['kpis']['clientes_en_riesgo'], 0)


class DashboardFidelidadApiTests(TestCase):
    def test_anonimo_no_puede_ver_el_dashboard(self):
        response = APIClient().get('/api/v1/dashboard/fidelidad/')
        self.assertIn(response.status_code, (401, 403))

    def test_autenticado_puede_ver_el_dashboard(self):
        user = get_user_model().objects.create_user(
            username='tester',
            password='tester',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/v1/dashboard/fidelidad/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['ok'])
        self.assertIn('kpis', response.data['data'])
