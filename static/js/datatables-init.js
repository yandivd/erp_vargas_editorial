(function () {
    'use strict';

    var ERP = window.ERP = window.ERP || {};
    var URL_IDIOMA = 'https://cdn.datatables.net/plug-ins/2.3.3/i18n/es-ES.json';
    var defaultsAplicados = false;

    function aplicarDefaults() {
        if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.DataTable || !window.DataTable) {
            return false;
        }

        if (defaultsAplicados) {
            return true;
        }

        var $ = window.jQuery;

        $.extend(true, window.DataTable.defaults, {
            language: {
                url: URL_IDIOMA
            },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
            order: [],
            autoWidth: false,
            defaultContent: '-',
            columnDefs: [
                { targets: 'no-sort', orderable: false, searchable: false }
            ]
        });

        defaultsAplicados = true;
        return true;
    }

    function esFilaVacia($fila, totalColumnas) {
        var $celdas = $fila.children('td, th');
        if ($celdas.length !== 1) {
            return false;
        }

        var colspan = parseInt($celdas.attr('colspan') || '1', 10);
        return colspan > 1 && colspan >= totalColumnas;
    }

    function contarFilasReales($tabla) {
        var totalColumnas = $tabla.find('thead th').length;
        var total = 0;

        $tabla.find('tbody tr').each(function () {
            if (!esFilaVacia($(this), totalColumnas)) {
                total += 1;
            }
        });

        return total;
    }

    function limpiarFilasVacias($tabla) {
        var totalColumnas = $tabla.find('thead th').length;
        if (!totalColumnas) {
            return;
        }

        $tabla.find('tbody tr').each(function () {
            if (esFilaVacia($(this), totalColumnas)) {
                $(this).remove();
            }
        });
    }

    function inicializar(selector, opciones) {
        if (!aplicarDefaults()) {
            return [];
        }

        var $ = window.jQuery;
        var $tablas = typeof selector === 'string'
            ? $(selector)
            : (selector ? $(selector) : $('table.datatable'));
        var instancias = [];

        $tablas.each(function () {
            if ($.fn.DataTable.isDataTable(this)) {
                instancias.push($(this).DataTable());
                return;
            }

            if (contarFilasReales($(this)) === 0) {
                return;
            }

            limpiarFilasVacias($(this));
            instancias.push($(this).DataTable(opciones || {}));
        });

        return instancias;
    }

    function destruir(selector) {
        if (!aplicarDefaults()) {
            return;
        }

        var $ = window.jQuery;
        var $tablas = typeof selector === 'string'
            ? $(selector)
            : (selector ? $(selector) : $('table.datatable'));

        $tablas.each(function () {
            if ($.fn.DataTable.isDataTable(this)) {
                $(this).DataTable().destroy();
            }
        });
    }

    function reiniciar(selector) {
        if (!aplicarDefaults()) {
            return [];
        }

        var $ = window.jQuery;
        var $tablas = typeof selector === 'string'
            ? $(selector)
            : (selector ? $(selector) : $('table.datatable'));

        $tablas.each(function () {
            var $tabla = $(this);
            var htmlFilas = $tabla.children('tbody').html();

            if ($.fn.DataTable.isDataTable(this)) {
                $tabla.DataTable().destroy();
            }

            if (htmlFilas !== undefined) {
                $tabla.children('tbody').html(htmlFilas);
            }
        });

        return inicializar($tablas);
    }

    function ajustar(selector) {
        if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.DataTable) {
            return;
        }

        var $ = window.jQuery;
        var $tablas = typeof selector === 'string'
            ? $(selector)
            : (selector ? $(selector) : $('table.datatable'));

        $tablas.each(function () {
            if ($.fn.DataTable.isDataTable(this)) {
                $(this).DataTable().columns.adjust().draw(false);
            }
        });
    }

    ERP.dataTables = {
        inicializar: inicializar,
        reiniciar: reiniciar,
        destruir: destruir,
        ajustar: ajustar
    };

    document.addEventListener('shown.bs.tab', function () {
        ajustar();
    });

    document.addEventListener('shown.bs.collapse', function () {
        ajustar();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            inicializar();
        });
    } else {
        inicializar();
    }
})();
