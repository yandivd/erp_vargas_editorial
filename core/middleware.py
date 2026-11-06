import threading
from datetime import date
from django.utils import timezone
from .models import Parametro

def actualizar_tasa_background():
    """Función que se ejecuta en un hilo separado para no bloquear al usuario."""
    try:
        from django.core.management import call_command
        # Ejecuta el comando que creamos antes
        call_command('actualizar_tasa')
        
        # Guardamos la fecha de hoy como número (YYYYMMDD) para que encaje en el DecimalField
        hoy_numero = int(date.today().strftime('%Y%m%d'))
        
        Parametro.objects.update_or_create(
            clave='ultima_actualizacion_tasa',
            defaults={'valor': hoy_numero, 'descripcion': 'Fecha de la última actualización automática de la tasa'}
        )
    except Exception as e:
        print(f"Error actualizando tasa en background: {e}")

class ActualizarTasaDiariaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Ignoramos archivos estáticos y media
        if not request.path.startswith('/static/') and not request.path.startswith('/media/'):
            hoy_numero = int(date.today().strftime('%Y%m%d'))
            
            try:
                # Buscamos cuándo fue la última actualización
                ultima_actualizacion = Parametro.objects.get(clave='ultima_actualizacion_tasa').valor
                # Convertimos el valor guardado a entero para comparar
                ultima_actualizacion = int(ultima_actualizacion) if ultima_actualizacion else None
            except (Parametro.DoesNotExist, ValueError):
                ultima_actualizacion = None

            # Si no hay registro o la fecha es menor a hoy, actualizamos
            if ultima_actualizacion != hoy_numero:
                # Lanzamos la tarea en un hilo
                threading.Thread(target=actualizar_tasa_background).start()

        response = self.get_response(request)
        return response