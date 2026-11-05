(function () {
    'use strict';

    const ERP = window.ERP = window.ERP || {};
    const MENSAJE_POR_DEFECTO = '¿Confirmas que deseas guardar estos cambios?';

    function success(mensaje) {
        if (window.Swal && window.Swal.fire) {
            return window.Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: mensaje,
                timer: 3000,
                showConfirmButton: false,
            });
        }

        return Promise.resolve();
    }

    function error(mensaje) {
        if (window.Swal && window.Swal.fire) {
            return window.Swal.fire({
                icon: 'error',
                title: 'Error',
                text: mensaje,
                confirmButtonText: 'OK',
            });
        }

        return Promise.resolve();
    }

    function confirm(mensaje, callback) {
        if (window.Swal && window.Swal.fire) {
            return window.Swal.fire({
                icon: 'question',
                title: 'Confirmación',
                text: mensaje,
                showCancelButton: true,
                confirmButtonText: 'Sí',
                cancelButtonText: 'No',
            }).then(function (resultado) {
                const aceptar = Boolean(resultado && resultado.isConfirmed);
                if (typeof callback === 'function') {
                    callback(aceptar);
                }
                return aceptar;
            });
        }

        return Promise.resolve(false);
    }

    ERP.alerts = { success, error, confirm };

    function esFormularioPost(form) {
        return form && form.tagName === 'FORM' && String(form.method || '').toLowerCase() === 'post';
    }

    function tieneOmision(elemento) {
        return elemento && elemento.hasAttribute('data-skip-confirm');
    }

    function mensajeDe(form, submitter) {
        return (submitter && submitter.dataset.confirm)
            || (form && form.dataset.confirm)
            || MENSAJE_POR_DEFECTO;
    }

    function enviarFormulario(form, submitter) {
        form.dataset.confirmado = 'true';

        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit(submitter || undefined);
        } else {
            form.submit();
        }

        delete form.dataset.confirmado;
    }

    document.addEventListener('submit', function (evento) {
        const form = evento.target;

        if (!esFormularioPost(form)) {
            return;
        }

        const submitter = evento.submitter;
        const omitir = form.dataset.confirmado === 'true'
            || tieneOmision(form)
            || tieneOmision(submitter);

        if (omitir) {
            return;
        }

        evento.preventDefault();
        evento.stopImmediatePropagation();

        confirm(mensajeDe(form, submitter)).then(function (aceptar) {
            if (aceptar) {
                enviarFormulario(form, submitter);
            }
        });
    }, true);

    document.addEventListener('click', function (evento) {
        const objetivo = evento.target;

        if (!objetivo || typeof objetivo.closest !== 'function') {
            return;
        }

        if (objetivo.closest('input, select, textarea, label, option')) {
            return;
        }

        const accion = objetivo.closest('[data-confirm]');

        if (!accion || accion.tagName === 'FORM'
            || accion.dataset.confirmado === 'true'
            || tieneOmision(accion)) {
            return;
        }

        const form = accion.closest('form');

        if (tieneOmision(form)) {
            return;
        }

        const esBotonEnvio = (accion.tagName === 'BUTTON' && String(accion.type || 'submit').toLowerCase() === 'submit')
            || (accion.tagName === 'INPUT' && String(accion.type || '').toLowerCase() === 'submit');

        if (esBotonEnvio) {
            return;
        }

        if (accion.tagName !== 'A' && accion.tagName !== 'BUTTON') {
            return;
        }

        evento.preventDefault();
        evento.stopImmediatePropagation();

        confirm(accion.dataset.confirm || MENSAJE_POR_DEFECTO).then(function (aceptar) {
            if (!aceptar) {
                return;
            }

            accion.dataset.confirmado = 'true';
            accion.click();
            delete accion.dataset.confirmado;
        });
    }, true);
})();
