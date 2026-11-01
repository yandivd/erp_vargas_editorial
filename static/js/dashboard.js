(function () {
    const ERP = window.ERP = window.ERP || {};
    const fmt = ERP.format;
    const state = {
        tab: 'resumen',
        data: {},
        loaded: {},
        requestId: 0,
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const el = byId(id);
        if (el) el.textContent = value;
    }

    function setHtml(id, value) {
        const el = byId(id);
        if (el) el.innerHTML = value;
    }

    function fechaBonita(valor) {
        if (!valor) return '';
        const partes = String(valor).slice(0, 10).split('-');
        return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : valor;
    }

    function filtros() {
        const form = byId('formFiltrosDashboard');
        if (!form) return {};
        return {
            desde: form.querySelector('[name=desde]').value,
            hasta: form.querySelector('[name=hasta]').value,
        };
    }

    function actualizarPeriodo(meta) {
        const f = filtros();
        const desde = fechaBonita((meta && meta.desde) || f.desde);
        const hasta = fechaBonita((meta && meta.hasta) || f.hasta);
        let texto = 'Todo el historial';
        if (desde && hasta) texto = 'Del ' + desde + ' al ' + hasta;
        else if (desde) texto = 'Desde ' + desde;
        else if (hasta) texto = 'Hasta ' + hasta;
        setText('dashPeriodo', texto);

        const exportar = byId('btnExportarIA');
        if (exportar) {
            exportar.href = '/exportar-ia/' + ERP.api.buildQuery(f);
        }
    }

    function actualizarTasa(meta) {
        const alerta = byId('dashTasaAviso');
        if (!alerta || !meta) return;
        const tasa = Number(meta.tasa_cambio || 0);
        setText('kpiTasaCambio', 'Tasa: ' + fmt.number(tasa));
        if (meta.advertencia_tasa) {
            alerta.className = 'alert alert-warning';
            alerta.innerHTML = '<i class="bi bi-exclamation-triangle"></i> La tasa de cambio no está configurada o es igual a 1.00. Configura <strong>Tasa_cambio</strong> en Parámetros para que los totales consolidados sean correctos.';
        } else {
            alerta.className = 'alert alert-warning d-none';
        }
    }

    function mostrarError(error) {
        const alerta = byId('dashError');
        if (!alerta) return;
        alerta.className = 'alert alert-danger';
        alerta.textContent = error && error.message ? error.message : 'No se pudieron cargar los datos.';
    }

    function limpiarError() {
        const alerta = byId('dashError');
        if (alerta) alerta.className = 'alert alert-danger d-none';
    }

    function mostrarCargando(activo) {
        const loading = byId('dashLoading');
        if (loading) loading.classList.toggle('d-none', !activo);
    }

    function tabla(tbodyId, filas, columnas, vacio) {
        const tbody = byId(tbodyId);
        if (!tbody) return;
        if (!filas || !filas.length) {
            tbody.innerHTML = '<tr><td colspan="' + columnas + '" class="text-center text-muted py-3">' + (vacio || 'Sin datos') + '</td></tr>';
            return;
        }
        tbody.innerHTML = filas.join('');
    }

    function renderResumen(data) {
        const k = data.kpis || {};
        const meta = data.meta || {};

        setText('kpiIngresosCup', fmt.money(k.ingresos_cup));
        setText('kpiIngresosUsd', 'USD: ' + fmt.money(k.ingresos_usd, 'USD'));
        setText('kpiGastosCup', fmt.money(k.gastos_cup));
        setText('kpiGastosUsd', 'USD: ' + fmt.money(k.gastos_usd, 'USD'));
        setText('kpiSaldoCup', fmt.money(k.saldo_neto_cup));
        setText('kpiSaldoUsd', 'USD: ' + fmt.money(k.saldo_neto_usd, 'USD'));
        setText('kpiMargen', Number(k.margen || 0).toFixed(1) + '%');
        setText('kpiFlujoCup', 'Flujo caja CUP: ' + fmt.money(k.flujo_neto_cup));
        setText('kpiPedidos', fmt.integer(k.total_pedidos));
        setText('kpiClientes', fmt.integer(k.clientes_unicos));
        setText('kpiVentas', fmt.money(k.ventas));
        setText('kpiGananciaPromedio', fmt.money(k.ganancia_promedio_cup));
        setText('kpiGananciaPromedioUsd', fmt.money(k.ganancia_promedio_usd, 'USD'));
        setText('kpiSaldoCajaCup', fmt.money(k.saldo_caja_cup));
        setText('kpiSaldoCajaUsd', fmt.money(k.saldo_caja_usd, 'USD'));
        setText('kpiSaldoCajaEquivCup', fmt.money(k.saldo_caja_equiv_cup));
        setText('kpiPasivos', fmt.money(k.pasivos_cup));
        setText('kpiPasivosDetalle', 'Anticipos ' + fmt.money(k.anticipos_cup) + ' + servicios ' + fmt.money(k.servicios_impagos_cup));
        actualizarPeriodo(meta);
        actualizarTasa(meta);

        const desglose = data.desglose_ingresos || [];
        ERP.charts.render('chartDesgloseIngresos', {
            type: 'doughnut',
            data: {
                labels: desglose.map(d => d.categoria),
                datasets: [{
                    data: desglose.map(d => d.total),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
            },
        });

        tabla('tablaCategoriasIngreso', desglose.map(d =>
            '<tr><td>' + fmt.escapeHtml(d.categoria) + '</td><td class="text-end">' + fmt.money(d.total) + '</td></tr>'
        ), 2, 'Sin ingresos operativos');

        const costo = data.costo_unitario || [];
        tabla('tablaCostoUnitario', costo.map(c =>
            '<tr><td>' + fmt.escapeHtml(c.material) + '<div class="small text-muted">' + fmt.escapeHtml(c.unidad || '') + '</div></td>' +
            '<td class="text-end hide-mobile">' + fmt.number(c.cantidad) + '</td>' +
            '<td class="text-end">' + fmt.money(c.costo_total) + '</td>' +
            '<td class="text-end hide-mobile">' + fmt.money(c.costo_unitario) + '</td></tr>'
        ), 4, 'Sin consumos de inventario');

        const tendencia = data.tendencia || [];
        ERP.charts.render('chartTendencia', {
            type: 'line',
            data: {
                labels: tendencia.map(t => t.mes),
                datasets: [
                    { label: 'Ingresos', data: tendencia.map(t => t.ingresos), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)', fill: true, tension: .3 },
                    { label: 'Gastos', data: tendencia.map(t => t.gastos), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.10)', fill: true, tension: .3 },
                ],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });

        const proyeccion = data.proyeccion || [];
        ERP.charts.render('chartProyeccion', {
            type: 'line',
            data: {
                labels: proyeccion.map(p => p.mes),
                datasets: [
                    { label: 'Ingresos proyectados', data: proyeccion.map(p => p.ingresos), borderColor: '#3b82f6', borderDash: [6, 4], tension: .3 },
                    { label: 'Gastos proyectados', data: proyeccion.map(p => p.gastos), borderColor: '#f59e0b', borderDash: [6, 4], tension: .3 },
                ],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });

        const semanal = data.semanal || [];
        ERP.charts.render('chartSemanal', {
            type: 'bar',
            data: {
                labels: semanal.map(s => s.semana),
                datasets: [
                    { label: 'Ingresos', data: semanal.map(s => s.ingresos), backgroundColor: '#10b981' },
                    { label: 'Gastos', data: semanal.map(s => s.gastos), backgroundColor: '#ef4444' },
                ],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });

        const calor = data.calor || { horas: [], filas: [], max: 0 };
        const head = byId('calorHead');
        if (head) {
            head.innerHTML = '<tr><th></th>' + calor.horas.map(h => '<th class="text-center small">' + h + '</th>').join('') + '</tr>';
        }
        const body = byId('calorBody');
        if (body) {
            body.innerHTML = calor.filas.map(fila =>
                '<tr><th class="small">' + fila.dia + '</th>' + fila.valores.map(v => {
                    const alpha = calor.max ? Math.max(.05, v / calor.max) : .05;
                    return '<td class="text-center"><span class="heatmap-cell" title="' + v + ' movimientos" style="background:rgba(59,130,246,' + alpha + ')"></span></td>';
                }).join('') + '</tr>'
            ).join('');
        }

        const transacciones = data.transacciones || [];
        tabla('tablaTransacciones', transacciones.map(t => {
            const color = t.tipo === 'INGRESO' ? 'success' : 'danger';
            return '<tr><td class="text-nowrap">' + fmt.escapeHtml(t.fecha) + '</td>' +
                '<td>' + fmt.badge(t.tipo, color) + '</td>' +
                '<td class="hide-mobile">' + fmt.escapeHtml(t.concepto) + '</td>' +
                '<td class="text-end text-nowrap">' + fmt.money(t.monto, t.moneda) + '</td></tr>';
        }), 4, 'Sin transacciones');

        const analisis = data.analisis_categorias || [];
        tabla('tablaAnalisis', analisis.map(a => {
            const color = a.tipo === 'INGRESO' ? 'success' : 'danger';
            return '<tr><td>' + fmt.escapeHtml(a.categoria) + '</td>' +
                '<td class="hide-mobile">' + fmt.badge(a.tipo, color) + '</td>' +
                '<td class="text-end hide-mobile">' + fmt.integer(a.cantidad) + '</td>' +
                '<td class="text-end text-nowrap">' + fmt.money(a.total, a.moneda) + '</td></tr>';
        }), 4, 'Sin movimientos');

        const consejos = data.consejos || [];
        setHtml('contenedorConsejos', consejos.length ? consejos.map(c =>
            '<div class="col-12 col-md-6"><div class="alert alert-' + fmt.escapeHtml(c.tipo) + ' mb-0 h-100">' +
            '<strong><i class="bi bi-info-circle"></i> ' + fmt.escapeHtml(c.titulo) + '</strong>' +
            '<div class="small mt-1">' + fmt.escapeHtml(c.texto) + '</div></div></div>'
        ).join('') : '<div class="col-12"><div class="alert alert-success mb-0">Todo en orden: no hay alertas para el período seleccionado.</div></div>');
    }

    function renderProduccion(data) {
        const k = data.kpis || {};
        setText('kpiProdPedidos', fmt.integer(k.pedidos_totales));
        setText('kpiProdLibros', fmt.integer(k.libros_unicos));
        setText('kpiProdUnPedido', fmt.integer(k.libros_con_un_pedido));
        setText('kpiProdRepetidos', fmt.integer(k.libros_repetidos));
        actualizarPeriodo(data.meta || {});

        const top10 = data.top10_data || [];
        ERP.charts.render('chartTop10', {
            type: 'bar',
            data: {
                labels: top10.map(l => l.titulo),
                datasets: [{ label: 'Pedidos', data: top10.map(l => l.total), backgroundColor: '#3b82f6' }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { ticks: { callback: v => String(v).slice(0, 24) } } },
            },
        });

        const pedidosMes = data.pedidos_mes_data || { labels: [], series: [] };
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];
        ERP.charts.render('chartPedidosMes', {
            type: 'line',
            data: {
                labels: pedidosMes.labels,
                datasets: pedidosMes.series.map((s, i) => ({
                    label: s.label,
                    data: s.data,
                    borderColor: colors[i % colors.length],
                    backgroundColor: 'transparent',
                    tension: .3,
                })),
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
        });

        const ranking = data.ranking_data || [];
        tabla('tablaRanking', ranking.map((l, i) =>
            '<tr><td class="text-muted">' + (i + 1) + '</td>' +
            '<td><strong>' + fmt.escapeHtml(l.titulo) + '</strong><div class="small text-muted">' + fmt.integer(l.paginas) + ' págs.</div></td>' +
            '<td class="hide-mobile">' + fmt.escapeHtml(l.autor) + '</td>' +
            '<td class="text-end">' + fmt.integer(l.pedidos) + '</td>' +
            '<td class="text-end hide-mobile">' + fmt.money(l.ventas) + '</td></tr>'
        ), 5, 'Sin pedidos');

        const recientes = data.recientes_data || [];
        setHtml('contenedorRecientes', recientes.length ? recientes.map(l =>
            '<div class="col-12 col-md-6 col-xl-4"><div class="border rounded-3 p-3 h-100">' +
            '<a href="/pedidos/libros/' + l.id + '/editar/" class="fw-bold text-decoration-none">' + fmt.escapeHtml(l.titulo) + '</a>' +
            '<div class="small text-muted">' + fmt.escapeHtml(l.autor) + '</div>' +
            '<div class="d-flex justify-content-between mt-2 small"><span>' + fmt.integer(l.pedidos) + ' pedidos</span><span>' + fmt.integer(l.clientes) + ' clientes</span></div>' +
            '<div class="small text-muted mt-1">Último: ' + fmt.escapeHtml(l.fecha) + '</div></div></div>'
        ).join('') : '<div class="col-12"><p class="text-muted mb-0">Sin libros recientes.</p></div>');
    }

    function telefonoLink(telefono) {
        const digits = String(telefono || '').replace(/\D/g, '');
        return digits ? 'https://wa.me/' + digits : '';
    }

    function renderClientes(data) {
        const k = data.kpis || {};
        setText('kpiCliUnicos', fmt.integer(k.clientes_unicos_total));
        setText('kpiCliNuevos', fmt.integer(k.clientes_nuevos));
        setText('kpiCliRecurrentes', fmt.integer(k.clientes_recurrentes));
        setText('kpiCliVip', fmt.integer(k.clientes_vip));
        setText('kpiCliRiesgo', fmt.integer(k.clientes_en_riesgo));
        setText('kpiCliPromedio', fmt.number(k.promedio_pedidos));
        actualizarPeriodo(data.meta || {});

        const tipos = data.tipo_cliente_data || [];
        ERP.charts.render('chartTipoCliente', {
            type: 'doughnut',
            data: {
                labels: tipos.map(t => t.tipo),
                datasets: [{ data: tipos.map(t => t.total), backgroundColor: ['#06b6d4', '#3b82f6', '#f59e0b'] }],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });

        const frecuencia = data.frecuencia_data || { labels: [], data: [] };
        ERP.charts.render('chartFrecuencia', {
            type: 'bar',
            data: {
                labels: frecuencia.labels,
                datasets: [{ label: 'Clientes', data: frecuencia.data, backgroundColor: '#10b981' }],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });

        const vip = data.clientes_vip_lista || [];
        const riesgo = data.clientes_riesgo_lista || [];
        tabla('tablaVip', vip.map(c => {
            const link = telefonoLink(c.telefono);
            return '<tr><td><a href="/clientes/' + c.id + '/" class="text-decoration-none fw-semibold">' + fmt.escapeHtml(c.nombre) + '</a></td>' +
                '<td class="text-end">' + fmt.integer(c.pedidos) + '</td>' +
                '<td class="text-end hide-mobile">' + fmt.money(c.total_gastado) + '</td>' +
                '<td class="hide-mobile">' + fmt.escapeHtml(c.ultimo_pedido) + '</td>' +
                '<td class="text-end">' + (link ? '<a href="' + link + '" target="_blank" rel="noopener" class="btn btn-success btn-sm"><i class="bi bi-whatsapp"></i></a>' : '') + '</td></tr>';
        }), 5, 'Sin clientes VIP');

        tabla('tablaRiesgo', riesgo.map(c => {
            const link = telefonoLink(c.telefono);
            return '<tr><td><a href="/clientes/' + c.id + '/" class="text-decoration-none fw-semibold">' + fmt.escapeHtml(c.nombre) + '</a></td>' +
                '<td class="text-end hide-mobile">' + fmt.integer(c.pedidos) + '</td>' +
                '<td class="text-end">' + fmt.integer(c.dias_sin_comprar) + '</td>' +
                '<td class="hide-mobile">' + fmt.escapeHtml(c.ultimo_pedido) + '</td>' +
                '<td class="text-end">' + (link ? '<a href="' + link + '" target="_blank" rel="noopener" class="btn btn-success btn-sm"><i class="bi bi-whatsapp"></i></a>' : '') + '</td></tr>';
        }), 5, 'Sin clientes en riesgo');

        byId('btnWhatsappVip')?.classList.toggle('d-none', vip.length === 0);
        byId('btnWhatsappRiesgo')?.classList.toggle('d-none', riesgo.length === 0);
    }

    function whatsappMasivo(clientes, etiqueta) {
        if (!clientes || !clientes.length) return;
        const texto = etiqueta + '\n' + clientes.map(c => c.nombre + ': ' + (c.telefono || 'sin teléfono')).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(() => {
                window.alert('Contactos copiados al portapapeles. Puedes pegarlos en WhatsApp.');
            }).catch(() => {
                window.alert(texto);
            });
        } else {
            window.alert(texto);
        }
    }

    async function cargar(tab, force) {
        if (!tab) return;
        if (state.loaded[tab] && !force) {
            state.tab = tab;
            return;
        }

        const id = ++state.requestId;
        state.tab = tab;
        limpiarError();
        mostrarCargando(true);

        try {
            const payload = await ERP.api.get('/api/core/dashboard/', Object.assign({ tab: tab }, filtros()));
            if (id !== state.requestId) return;
            state.data[tab] = payload.data;
            state.loaded[tab] = true;

            if (tab === 'resumen') renderResumen(payload.data);
            else if (tab === 'produccion') renderProduccion(payload.data);
            else if (tab === 'clientes') renderClientes(payload.data);
        } catch (error) {
            if (id === state.requestId) mostrarError(error);
        } finally {
            if (id === state.requestId) mostrarCargando(false);
        }
    }

    function init() {
        if (!byId('pane-resumen')) return;

        document.querySelectorAll('#dashboardTabs [data-tab]').forEach(btn => {
            btn.addEventListener('shown.bs.tab', event => {
                cargar(event.target.dataset.tab);
            });
        });

        const form = byId('formFiltrosDashboard');
        if (form) {
            form.addEventListener('submit', event => {
                event.preventDefault();
                state.loaded = {};
                cargar(state.tab || 'resumen', true);
            });
        }

        byId('btnWhatsappVip')?.addEventListener('click', () => {
            whatsappMasivo((state.data.clientes || {}).clientes_vip_lista, 'Clientes VIP');
        });
        byId('btnWhatsappRiesgo')?.addEventListener('click', () => {
            whatsappMasivo((state.data.clientes || {}).clientes_riesgo_lista, 'Clientes en riesgo');
        });

        actualizarPeriodo({});
        const activo = document.querySelector('#dashboardTabs .nav-link.active');
        cargar(activo ? activo.dataset.tab : 'resumen', true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
