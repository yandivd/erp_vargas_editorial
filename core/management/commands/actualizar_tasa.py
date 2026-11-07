from decimal import Decimal
import os
import requests
import urllib3
from datetime import datetime
from django.core.management.base import BaseCommand
from core.models import Parametro

# Desactivar advertencias de SSL (la API de ElToque a veces tiene problemas de certificados)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class Command(BaseCommand):
    help = 'Actualiza la tasa de cambio desde la API de ElToque'

    def handle(self, *args, **kwargs):
        self.stdout.write("Iniciando actualización de tasa de cambio...")

        token = os.environ.get('ELTOQUE_API_TOKEN')
        if not token:
            self.stderr.write(self.style.ERROR("Error: La variable ELTOQUE_API_TOKEN no está configurada en el .env"))
            return

        fecha_actual = datetime.now().strftime('%Y-%m-%d')
        url = f'https://tasas.eltoque.com/v1/trmi?date_to={fecha_actual}%2000%3A00%3A01'

        headers = {
            'accept': '*/*',
            'Authorization': f'Bearer {token}'
        }

        try:
            self.stdout.write(f"Consultando API para la fecha {fecha_actual}...")
            response = requests.get(url, headers=headers, timeout=30, verify=False)
            response.raise_for_status()

            data = response.json()
            
            if 'tasas' not in data or 'USD' not in data['tasas']:
                self.stderr.write(self.style.ERROR("La respuesta de la API no tiene el formato esperado."))
                return

            nueva_tasa = data['tasas']['USD']
            self.stdout.write(f"Tasa obtenida: 1 USD = {nueva_tasa} CUP")

            # Actualizar el parámetro en la base de datos
            parametro, created = Parametro.objects.get_or_create(clave='Tasa_cambio')
            valor_anterior = parametro.valor
            parametro.valor = Decimal(str(nueva_tasa))
            parametro.save()

            self.stdout.write(self.style.SUCCESS(
                f"Tasa actualizada exitosamente. (Anterior: {valor_anterior} -> Nueva: {nueva_tasa})"
            ))

        except requests.exceptions.RequestException as e:
            self.stderr.write(self.style.ERROR(f"Error en la petición HTTP: {e}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error inesperado: {e}"))