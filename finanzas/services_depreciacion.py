from datetime import date
from decimal import Decimal
from .models import ActivoFijo, Depreciacion, MovimientoCaja

class ServicioDepreciacion:
    
    @staticmethod
    def depreciar_mes(anio, mes):
        """Calcula y registra la depreciación de todos los activos para un mes."""
        primer_dia = date(anio, mes, 1)
        resultados = []
        
        for activo in ActivoFijo.objects.filter(activo=True):
            # Si ya se depreció este mes, lo saltamos
            if Depreciacion.objects.filter(activo=activo, mes=primer_dia).exists():
                continue
            
            dep_mensual = Decimal(str(activo.depreciacion_mensual))
            valor_maximo = activo.valor_compra - activo.valor_residual
            pendiente = valor_maximo - activo.depreciacion_acumulada
            
            if pendiente <= 0:
                continue  # Ya está totalmente depreciado
            
            # Si el pendiente es menor a la dep mensual, depreciamos solo el pendiente
            monto = min(dep_mensual, pendiente)
            
            # 1. Crear el registro histórico de depreciación
            dep = Depreciacion.objects.create(
                activo=activo,
                mes=primer_dia,
                monto=monto
            )
            
            # 2. Actualizar la depreciación acumulada del activo
            activo.depreciacion_acumulada += monto
            activo.save()
            
            resultados.append(dep)
        
        return resultados