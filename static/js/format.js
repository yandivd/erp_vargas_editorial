(function () {
    const ERP = window.ERP = window.ERP || {};

    const numberFormat = new Intl.NumberFormat('es-CU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const integerFormat = new Intl.NumberFormat('es-CU', {
        maximumFractionDigits: 0,
    });

    function money(value, currency) {
        const number = Number(value || 0);
        const prefix = currency === 'USD' ? 'US$' : '$';
        return prefix + numberFormat.format(number);
    }

    function number(value) {
        return numberFormat.format(Number(value || 0));
    }

    function integer(value) {
        return integerFormat.format(Number(value || 0));
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function badge(text, color) {
        return '<span class="badge bg-' + escapeHtml(color || 'secondary') + '">' + escapeHtml(text) + '</span>';
    }

    ERP.format = { money, number, integer, escapeHtml, badge };
})();
