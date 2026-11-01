(function () {
    const ERP = window.ERP = window.ERP || {};

    function item(label, page, disabled, active, ariaLabel) {
        const classes = ['page-item'];
        if (disabled) classes.push('disabled');
        if (active) classes.push('active');
        const content = page && !disabled && !active
            ? '<a class="page-link" href="#" data-page="' + page + '">' + label + '</a>'
            : '<span class="page-link">' + label + '</span>';
        const labelAttr = ariaLabel ? ' aria-label="' + ariaLabel + '"' : '';
        return '<li class="' + classes.join(' ') + '"' + labelAttr + '>' + content + '</li>';
    }

    function render(container, pagination, onPage) {
        if (!container || !pagination) return;

        const start = pagination.start_index || 0;
        const end = pagination.end_index || 0;
        const total = pagination.total || 0;
        const options = pagination.per_page_options || [10, 25, 50];
        const selectOptions = options
            .map(n => '<option value="' + n + '"' + (n === pagination.per_page ? ' selected' : '') + '>' + n + '</option>')
            .join('');

        const pages = (pagination.page_range || []).map(itemPage => {
            if (itemPage === '…' || itemPage === '...') {
                return item('…', null, true, false);
            }
            return item(String(itemPage), itemPage, false, itemPage === pagination.page);
        }).join('');

        const controls = pagination.num_pages > 1
            ? '<ul class="pagination pagination-sm mb-0 flex-wrap">' +
                item('&laquo;', 1, !pagination.has_previous, false, 'Primera') +
                item('Anterior', pagination.previous_page, !pagination.has_previous, false) +
                pages +
                item('Siguiente', pagination.next_page, !pagination.has_next, false) +
                item('&raquo;', pagination.num_pages, !pagination.has_next, false, 'Última') +
              '</ul>'
            : '';

        container.innerHTML =
            '<div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 w-100">' +
                '<div class="d-flex align-items-center gap-2 flex-wrap">' +
                    '<small class="text-muted">Mostrando ' + start + ' - ' + end + ' de ' + total + '</small>' +
                    '<label class="small text-muted mb-0 d-flex align-items-center gap-1">' +
                        'Por página' +
                        '<select class="form-select form-select-sm js-per-page" style="width:auto">' + selectOptions + '</select>' +
                    '</label>' +
                '</div>' +
                controls +
            '</div>';

        container.querySelectorAll('a[data-page]').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                const page = Number(link.dataset.page);
                if (page) onPage(page, pagination.per_page);
            });
        });

        const select = container.querySelector('.js-per-page');
        if (select) {
            select.addEventListener('change', () => {
                onPage(1, Number(select.value));
            });
        }
    }

    ERP.pagination = { render };
})();
