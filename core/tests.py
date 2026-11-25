from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clientes.models import Cliente, EventoFidelidad, TarjetaFidelidad
from clientes.services import ServicioFidelidad
from core.models import Parametro
from core.services import dashboard_fidelidad, exportar_rentabilidad_para_ia, secciones_rentabilidad_ia
from finanzas.models import MovimientoCaja
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
        self.assertEqual(kpis['pedidos_activos'], 1)
        self.assertEqual(kpis['pedidos_inactivos'], 1)
        self.assertEqual(kpis['ticket_medio_activo'], 1000.0)
        self.assertEqual(kpis['ticket_medio_inactivo'], 2000.0)
        self.assertEqual(kpis['ingresos_activos'], 1000.0)
        self.assertEqual(kpis['ingresos_inactivos'], 2000.0)
        self.assertEqual(kpis['bono_canjeado_total'], 500.0)
        self.assertEqual(kpis['pedidos_con_bono'], 1)
        self.assertEqual(
            data['composicion_ingresos'],
            [
                {'tipo': 'Activos', 'total': 1000.0},
                {'tipo': 'Inactivos', 'total': 2000.0},
            ],
        )

    def test_cliente_con_bono_sin_sellos_es_activo(self):
        cliente = Cliente.objects.create(nombre='Cliente Con Bono')
        TarjetaFidelidad.objects.create(
            cliente=cliente,
            sellos=0,
            bono_saldo=Decimal('1000'),
            fecha_ultima_compra=timezone.now(),
        )
        Pedido.objects.create(
            cliente=cliente,
            libro=self.libro,
            estado=self.estado,
            cantidad=1,
            precio_venta=Decimal('3000'),
        )

        data = dashboard_fidelidad()

        self.assertEqual(data['kpis']['tarjetas_activas'], 3)
        self.assertEqual(data['kpis']['pedidos_activos'], 2)
        self.assertEqual(data['kpis']['pedidos_inactivos'], 1)
        self.assertEqual(data['kpis']['ingresos_activos'], 4000.0)
        self.assertEqual(data['kpis']['ingresos_inactivos'], 2000.0)

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


class EventoFidelidadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.estado = Estado.objects.create(nombre='Entregado', es_final=True)
        cls.libro = Book.objects.create(
            titulo='Libro de prueba',
            paginas=100,
            precio=Decimal('1000'),
        )
        Parametro.objects.update_or_create(
            clave='fidelidad_sellos_meta',
            defaults={'valor': 2, 'descripcion': 'test'},
        )
        Parametro.objects.update_or_create(
            clave='fidelidad_bono_monto',
            defaults={'valor': 100, 'descripcion': 'test'},
        )
        Parametro.objects.update_or_create(
            clave='fidelidad_dias_expiracion',
            defaults={'valor': 30, 'descripcion': 'test'},
        )

    def _pedido(self, cliente, cantidad=1):
        return Pedido.objects.create(
            cliente=cliente,
            libro=self.libro,
            estado=self.estado,
            cantidad=cantidad,
            precio_venta=Decimal('1000'),
        )

    def test_otorgamiento_al_alcanzar_la_meta(self):
        cliente = Cliente.objects.create(nombre='Cliente')
        pedido = self._pedido(cliente, cantidad=2)

        ServicioFidelidad.registrar_compra(pedido)

        tarjeta = cliente.tarjeta_fidelidad
        self.assertEqual(tarjeta.sellos, 2)
        self.assertEqual(tarjeta.bono_saldo, Decimal('100'))
        evento = EventoFidelidad.objects.get(
            tipo=EventoFidelidad.Tipo.OTORGAMIENTO,
        )
        self.assertEqual(evento.tarjeta_id, tarjeta.id)
        self.assertEqual(evento.cantidad, Decimal('100'))
        self.assertEqual(evento.pedido_id, pedido.id)

    def test_canje_crea_evento(self):
        cliente = Cliente.objects.create(nombre='Cliente')
        TarjetaFidelidad.objects.create(
            cliente=cliente,
            sellos=2,
            bono_saldo=Decimal('100'),
        )
        pedido = self._pedido(cliente)

        descuento = ServicioFidelidad.aplicar_bono(
            cliente,
            Decimal('40'),
            pedido=pedido,
        )

        self.assertEqual(descuento, Decimal('40'))
        evento = EventoFidelidad.objects.get(tipo=EventoFidelidad.Tipo.CANJE)
        self.assertEqual(evento.cantidad, Decimal('40'))
        self.assertEqual(evento.pedido_id, pedido.id)

    def test_expiracion_crea_evento(self):
        cliente = Cliente.objects.create(nombre='Cliente')
        tarjeta = TarjetaFidelidad.objects.create(
            cliente=cliente,
            sellos=3,
            fecha_ultima_compra=timezone.now() - timedelta(days=31),
        )

        self.assertTrue(ServicioFidelidad._expirar_sellos(tarjeta))

        evento = EventoFidelidad.objects.get(
            tipo=EventoFidelidad.Tipo.EXPIRACION,
        )
        self.assertEqual(evento.cantidad, Decimal('3'))
        tarjeta.refresh_from_db()
        self.assertEqual(tarjeta.sellos, 0)

    def test_metricas_de_conversion_y_canje(self):
        cliente = Cliente.objects.create(nombre='Cliente')
        pedido = self._pedido(cliente, cantidad=2)
        ServicioFidelidad.registrar_compra(pedido)
        ServicioFidelidad.aplicar_bono(cliente, Decimal('40'), pedido=pedido)

        cliente_expirado = Cliente.objects.create(nombre='Expirado')
        TarjetaFidelidad.objects.create(
            cliente=cliente_expirado,
            sellos=5,
            fecha_ultima_compra=timezone.now() - timedelta(days=31),
        )
        ServicioFidelidad.expirar_tarjetas_inactivas()

        data = dashboard_fidelidad()
        kpis = data['kpis']

        self.assertEqual(kpis['tarjetas_total'], 2)
        self.assertEqual(kpis['tarjetas_convertidas'], 1)
        self.assertEqual(kpis['tasa_conversion_bono'], 50.0)
        self.assertEqual(kpis['bonos_otorgados'], 1)
        self.assertEqual(kpis['monto_bono_otorgado'], 100.0)
        self.assertEqual(kpis['monto_bono_canjeado'], 40.0)
        self.assertEqual(kpis['tasa_canje'], 40.0)
        self.assertEqual(kpis['eventos_expiracion'], 1)

    def test_consultar_fidelidad_no_crea_tarjeta(self):
        cliente = Cliente.objects.create(nombre='Sin tarjeta')

        self.assertIsNone(ServicioFidelidad.obtener_tarjeta(cliente))
        self.assertIsNone(ServicioFidelidad.estado(cliente))
        self.assertFalse(TarjetaFidelidad.objects.filter(cliente=cliente).exists())

    def test_registrar_compra_crea_tarjeta(self):
        cliente = Cliente.objects.create(nombre='Con pedido')
        pedido = self._pedido(cliente)

        self.assertFalse(TarjetaFidelidad.objects.filter(cliente=cliente).exists())

        ServicioFidelidad.registrar_compra(pedido)

        tarjeta = TarjetaFidelidad.objects.get(cliente=cliente)
        self.assertEqual(tarjeta.sellos, 1)
        self.assertEqual(tarjeta.bono_saldo, Decimal('0'))

    def test_limpiar_tarjetas_vacias(self):
        cliente_vacio = Cliente.objects.create(nombre='Vacia')
        TarjetaFidelidad.objects.create(cliente=cliente_vacio)
        cliente_activo = Cliente.objects.create(nombre='Activa')
        tarjeta_activa = TarjetaFidelidad.objects.create(
            cliente=cliente_activo,
            sellos=1,
            fecha_ultima_compra=timezone.now(),
        )

        call_command('limpiar_tarjetas_vacias')

        self.assertFalse(TarjetaFidelidad.objects.filter(cliente=cliente_vacio).exists())
        self.assertTrue(TarjetaFidelidad.objects.filter(pk=tarjeta_activa.pk).exists())


class ExportarIAAgrupadoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.estado = Estado.objects.create(nombre='Entregado', es_final=True)
        cls.libro = Book.objects.create(
            titulo='Libro de prueba',
            paginas=100,
            precio=Decimal('1000'),
        )
        cls.cliente = Cliente.objects.create(nombre='Cliente')
        Pedido.objects.create(
            cliente=cls.cliente,
            libro=cls.libro,
            estado=cls.estado,
            cantidad=2,
            precio_venta=Decimal('1000'),
            descuento_aplicado=Decimal('100'),
        )
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='GASTO_OPERATIVO',
            monto=Decimal('500'),
            concepto='Luz',
        )

    def test_export_rentabilidad_esta_agrupado(self):
        data = exportar_rentabilidad_para_ia()

        self.assertNotIn('pedidos', data)
        self.assertIn('pedidos_agrupados', data)
        self.assertEqual(data['pedidos_agrupados']['total_pedidos'], 1)
        self.assertTrue(data['pedidos_agrupados']['por_mes'])
        self.assertIsInstance(data['gastos_operativos'], dict)
        self.assertEqual(data['gastos_operativos']['total_movimientos'], 1)
        self.assertTrue(data['gastos_operativos']['por_concepto'])

    def test_secciones_estan_agrupadas(self):
        data = secciones_rentabilidad_ia()

        self.assertNotIn('rentabilidad_por_pedido', data)
        self.assertEqual(data['rentabilidad_agrupada']['total_pedidos'], 1)
