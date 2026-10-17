from datetime import date
from decimal import Decimal
from .models import ActivoFijo, Depreciacion


class ServicioDepreciacion:
    
    @staticmethod
    def depreciar_mes(anio, mes):
        """
        Deprecia todos los activos para un mes específico.
        Se llama una vez al mes desde el admin o por comando.
        """
        primer_dia = date(anio, mes, 1)
        resultados = []
        
        for activo in ActivoFijo.objects.filter(activo=True):
            # Evitar duplicados
            if Depreciacion.objects.filter(activo=activo, mes=primer_dia).exists():
                continue
            
            # Verificar que la depreciación no supere el valor
            dep_mensual = Decimal(str(activo.depreciacion_mensual))
            valor_maximo = activo.valor_compra - activo.valor_residual
            pendiente = valor_maximo - activo.depreciacion_acumulada
            
            if pendiente <= 0:
                continue  # ya está totalmente depreciado
            
            monto = min(dep_mensual, pendiente)
            
            # Crear registro
            dep = Depreciacion.objects.create(
                activo=activo,
                mes=primer_dia,
                monto=monto
            )
            
            # Actualizar acumulada
            activo.depreciacion_acumulada += monto
            activo.save()
            
            resultados.append(dep)
        
        return resultados