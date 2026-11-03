(function () {
    'use strict';

    const ERP = window.ERP = window.ERP || {};

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
})();
