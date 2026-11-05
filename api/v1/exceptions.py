import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def _primer_error(detail):
    if isinstance(detail, dict):
        for campo, errores in detail.items():
            mensaje = _primer_error(errores)
            if campo in ('non_field_errors', 'detail'):
                return mensaje
            return f'{campo}: {mensaje}'
        return 'Error de validación.'

    if isinstance(detail, (list, tuple)):
        if not detail:
            return 'Error de validación.'
        return _primer_error(detail[0])

    return str(detail)


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    if response is None:
        logger.error(
            'Excepción no controlada en la API',
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return Response(
            {'ok': False, 'error': 'Error interno del servidor.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    response.data = {
        'ok': False,
        'error': _primer_error(response.data),
    }
    return response
