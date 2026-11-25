from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clientes.models import Cliente, EventoFidelidad, TarjetaFidelidad
from clientes.services import ServicioFidelidad
from core.models import Parametro
from core.services import (
    dashboard_fidelidad,
    dashboard_produccion,
    dashboard_resumen,
    exportar_rentabilidad_para_ia,
    secciones_rentabilidad_ia,
    tasa_cambio,
)
from finanzas.models import CierreCaja, MovimientoCaja
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
        cls.estado_activo = Estado.objects.create(nombre='Pegado', es_final=False)
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
        Pedido.objects.create(
            cliente=cls.cliente,
            libro=cls.libro,
            estado=cls.estado_activo,
            cantidad=1,
            precio_venta=Decimal('6000'),
            anticipo_recibido=Decimal('2000'),
        )
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='GASTO_OPERATIVO',
            monto=Decimal('500'),
            concepto='Luz',
        )

    def test_export_rentabilidad_usa_estructura_exacta(self):
        data = exportar_rentabilidad_para_ia()

        self.assertEqual(
            set(data),
            {
                'meta',
                'resumen_financiero',
                'pedidos_activos',
                'metricas_produccion',
                'rentabilidad_por_plan',
                'clientes_en_riesgo',
            },
        )
        self.assertEqual(
            set(data['meta']),
            {'fecha_corte', 'tasa_cambio_usd_cup', 'moneda_base'},
        )
        self.assertEqual(
            set(data['resumen_financiero']),
            {
                'ingresos_devengados',
                'gastos_operativos',
                'utilidad_neta',
                'margen_por_pedido_entregado',
                'flujo_caja_neto',
                'saldo_caja_cup',
                'saldo_caja_usd',
                'saldo_caja_usd_equiv_cup',
                'total_disponible_cup',
                'reserva_divisa_porcentaje',
                'anticipos_pasivos',
                'deuda_clientes',
                'dinero_proyectado',
            },
        )
        self.assertEqual(data['resumen_financiero']['ingresos_devengados'], 1000.0)
        self.assertEqual(data['resumen_financiero']['gastos_operativos'], 500.0)
        self.assertEqual(
            [fila['plan'] for fila in data['rentabilidad_por_plan']],
            ['Base', 'Medio', 'Premium'],
        )
        self.assertEqual(
            set(data['pedidos_activos'][0]),
            {
                'pedido_id',
                'cliente',
                'estado_actual',
                'dias_en_estado',
                'anticipo_pagado',
                'costo_produccion',
                'saldo_pendiente',
                'riesgo_anticipo',
            },
        )

    def test_secciones_estan_agrupadas(self):
        data = secciones_rentabilidad_ia()

        self.assertNotIn('rentabilidad_por_pedido', data)
        self.assertEqual(data['rentabilidad_agrupada']['total_pedidos'], 2)


class DashboardProduccionEntregasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.estado = Estado.objects.create(nombre='Entregado', es_final=True)
        cls.libro = Book.objects.create(
            titulo='Libro de prueba',
            paginas=100,
            precio=Decimal('1000'),
        )
        cls.cliente = Cliente.objects.create(nombre='Cliente')
        pedido = Pedido.objects.create(
            cliente=cls.cliente,
            libro=cls.libro,
            estado=cls.estado,
            cantidad=1,
            precio_venta=Decimal('1000'),
        )
        Pedido.objects.filter(pk=pedido.pk).update(
            fecha_pedido=timezone.make_aware(
                datetime(2026, 10, 5, 10, 0),
                timezone.get_default_timezone(),
            ),
            fecha_entrega_real=timezone.make_aware(
                datetime(2026, 11, 24, 17, 32),
                timezone.get_default_timezone(),
            ),
        )

    def test_entregados_se_agrupan_por_fecha_entrega_real(self):
        data = dashboard_produccion(date(2026, 10, 1), date(2026, 11, 30))
        filas = data['comportamiento_pedidos_mes']

        self.assertEqual([fila['pedidos'] for fila in filas], [1, 0])
        self.assertEqual([fila['entregados'] for fila in filas], [0, 1])
        self.assertEqual([fila['ingreso_total'] for fila in filas], [1000.0, 0.0])
        self.assertEqual(
            [fila['ingreso_entregados'] for fila in filas], [0.0, 1000.0]
        )


class DashboardResumenLiquidezTests(TestCase):
    def test_liquidez_y_flujo_usan_caja_real(self):
        tasa, _ = tasa_cambio()
        MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='INGRESO_MANUAL',
            monto=Decimal('1000'),
            moneda='CUP',
            concepto='Venta',
        )
        MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='INGRESO_MANUAL',
            monto=Decimal('100'),
            moneda='USD',
            concepto='Venta USD',
        )
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='GASTO_OPERATIVO',
            monto=Decimal('200'),
            moneda='CUP',
            concepto='Luz',
        )

        kpis = dashboard_resumen()['kpis']
        equivalente_usd = Decimal('100') * tasa

        self.assertEqual(kpis['saldo_caja_cup'], 800.0)
        self.assertEqual(kpis['saldo_caja_usd'], 100.0)
        self.assertIn('margen_por_pedido_entregado', kpis)
        self.assertAlmostEqual(
            kpis['saldo_caja_usd_equiv_cup'], float(equivalente_usd), places=2
        )
        self.assertAlmostEqual(
            kpis['total_disponible_cup'],
            float(Decimal('800') + equivalente_usd),
            places=2,
        )
        self.assertAlmostEqual(
            kpis['flujo_caja_neto'],
            float(Decimal('1000') + equivalente_usd - Decimal('200')),
            places=2,
        )

    def test_efectivo_y_tarjeta_usan_ultimo_arqueo(self):
        anterior = CierreCaja.objects.create(
            saldo_sistema=Decimal('1000'),
            efectivo_real=Decimal('1000'),
            diferencia=Decimal('0'),
            transferencia=Decimal('100'),
        )
        reciente = CierreCaja.objects.create(
            saldo_sistema=Decimal('5000'),
            efectivo_real=Decimal('5000'),
            diferencia=Decimal('0'),
            transferencia=Decimal('700'),
        )
        CierreCaja.objects.filter(pk=anterior.pk).update(
            fecha=timezone.make_aware(
                datetime(2026, 11, 20, 10, 0),
                timezone.get_default_timezone(),
            )
        )
        CierreCaja.objects.filter(pk=reciente.pk).update(
            fecha=timezone.make_aware(
                datetime(2026, 11, 24, 17, 0),
                timezone.get_default_timezone(),
            )
        )

        kpis = dashboard_resumen()['kpis']

        self.assertEqual(kpis['efectivo_ultimo_arqueo_cup'], 4300.0)
        self.assertEqual(kpis['tarjeta_ultimo_arqueo_cup'], 700.0)
        self.assertEqual(kpis['total_ultimo_arqueo_cup'], 5000.0)
        self.assertIsNotNone(kpis['fecha_ultimo_arqueo'])

    def test_flujo_dinero_real_incluye_todas_entradas_y_solo_gastos_reales(self):
        MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='VENTA_DIVISA',
            monto=Decimal('500'),
            moneda='CUP',
            concepto='Venta de divisa',
        )
        MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='ANTICIPO_CLIENTE',
            monto=Decimal('200'),
            moneda='CUP',
            concepto='Anticipo',
        )
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='PAGO_PROVEEDOR',
            monto=Decimal('100'),
            moneda='CUP',
            concepto='Proveedor',
        )
        MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='COMPRA_MATERIAL',
            monto=Decimal('50'),
            moneda='CUP',
            concepto='Material',
        )
        for categoria in ['TRANSFERENCIA', 'COMPRA_DIVISA', 'AJUSTE_FALTANTE']:
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria=categoria,
                monto=Decimal('999'),
                moneda='CUP',
                concepto='No es gasto real',
            )

        serie = dashboard_resumen()['flujo_dinero_real']
        fila = serie[-1]

        self.assertEqual(fila['entradas'], 700.0)
        self.assertEqual(fila['salidas'], 150.0)
