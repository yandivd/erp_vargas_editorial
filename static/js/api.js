(function () {
    const ERP = window.ERP = window.ERP || {};

    function getCookie(name) {
        const value = document.cookie
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith(name + '='));
        return value ? decodeURIComponent(value.split('=').slice(1).join('=')) : null;
    }

    function csrfToken() {
        return getCookie('csrftoken')
            || document.querySelector('[name=csrfmiddlewaretoken]')?.value
            || '';
    }

    function buildQuery(params) {
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, value);
            }
        });
        const text = query.toString();
        return text ? '?' + text : '';
    }

    async function request(url, options) {
        const opts = Object.assign({}, options || {});
        opts.headers = Object.assign({}, opts.headers || {});
        opts.credentials = 'same-origin';

        if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(opts.body);
        }

        if (opts.method && opts.method.toUpperCase() !== 'GET') {
            opts.headers['X-CSRFToken'] = csrfToken();
        }

        const response = await fetch(url, opts);
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await response.json()
            : { ok: false, error: await response.text() };

        if (!response.ok || payload.ok === false) {
            const error = new Error(payload.error || 'Error al procesar la solicitud');
            error.status = response.status;
            error.payload = payload;
            throw error;
        }
        return payload;
    }

    function get(url, params) {
        return request(url + buildQuery(params), { method: 'GET' });
    }

    function post(url, body) {
        return request(url, { method: 'POST', body: body || {} });
    }

    function extraerLista(payload, clave) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (!payload || typeof payload !== 'object') {
            return [];
        }
        if (clave && Array.isArray(payload[clave])) {
            return payload[clave];
        }
        const claves = Object.keys(payload);
        if (claves.length === 1 && Array.isArray(payload[claves[0]])) {
            return payload[claves[0]];
        }
        return [];
    }

    async function getAll(url, params, opciones) {
        const baseParams = Object.assign({}, params || {});
        const clave = opciones && opciones.clave;
        const first = await get(url, Object.assign({}, baseParams, { page: 1, per_page: 100 }));
        const data = extraerLista(first.data, clave).slice();

        if (!first.pagination || !first.pagination.num_pages) {
            return {
                data,
                meta: first.meta,
                pagination: null,
                payloads: [first]
            };
        }

        const numPages = first.pagination.num_pages;
        const perPage = first.pagination.per_page;
        const pendientes = [];

        for (let page = 2; page <= numPages; page++) {
            pendientes.push(get(url, Object.assign({}, baseParams, { page, per_page: perPage })));
        }

        const resultados = await Promise.all(pendientes);
        resultados.forEach(resultado => {
            data.push(...extraerLista(resultado.data, clave));
        });

        return {
            data,
            meta: first.meta,
            pagination: first.pagination,
            payloads: [first].concat(resultados)
        };
    }

    ERP.api = { get, post, getAll, request, buildQuery, csrfToken };
})();
