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

    ERP.api = { get, post, request, buildQuery, csrfToken };
})();
