import json
import logging

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .services import ejecutar_agente


logger = logging.getLogger(__name__)


def chat(request):
    return render(request, 'agente_analista/chat.html')


@csrf_exempt
def chat_api(request):
    # TODO: quitar csrf_exempt y proteger el endpoint con autenticación y CSRF.
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido.'}, status=405)

    try:
        datos = json.loads(request.body or b'{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': 'JSON inválido.'}, status=400)

    if not isinstance(datos, dict):
        return JsonResponse({'error': 'El cuerpo debe ser un objeto JSON.'}, status=400)

    mensaje = datos.get('mensaje')
    if not isinstance(mensaje, str) or not mensaje.strip():
        return JsonResponse({'error': 'El campo "mensaje" es obligatorio.'}, status=400)

    try:
        respuesta = ejecutar_agente(mensaje.strip())
    except Exception as exc:
        logger.exception('Error al ejecutar el agente financiero.')
        return JsonResponse({'error': str(exc)}, status=500)

    return JsonResponse({'respuesta': respuesta})
