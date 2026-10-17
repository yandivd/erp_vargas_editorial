from django.core.management.base import BaseCommand
from datetime import date
from finanzas.services_depreciacion import ServicioDepreciacion


class Command(BaseCommand):
    help = 'Registra la depreciación mensual de los activos fijos'
    
    def add_arguments(self, parser):
        parser.add_argument('--anio', type=int, default=date.today().year)
        parser.add_argument('--mes', type=int, default=date.today().month)
    
    def handle(self, *args, **options):
        anio = options['anio']
        mes = options['mes']
        
        self.stdout.write(f'Depreciando activos para {mes}/{anio}...')
        resultados = ServicioDepreciacion.depreciar_mes(anio, mes)
        
        for dep in resultados:
            self.stdout.write(
                self.style.SUCCESS(f'  ✓ {dep.activo.nombre}: {dep.monto}')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Total: {len(resultados)} activos depreciados')
        )