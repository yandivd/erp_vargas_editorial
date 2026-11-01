(function () {
    const ERP = window.ERP = window.ERP || {};
    const registry = {};

    function destroy(id) {
        if (registry[id]) {
            registry[id].destroy();
            delete registry[id];
        }
    }

    function render(id, config) {
        const canvas = document.getElementById(id);
        if (!canvas || typeof Chart === 'undefined') return;
        destroy(id);
        registry[id] = new Chart(canvas, config);
    }

    function destroyAll() {
        Object.keys(registry).forEach(destroy);
    }

    ERP.charts = { render, destroy, destroyAll };
})();
