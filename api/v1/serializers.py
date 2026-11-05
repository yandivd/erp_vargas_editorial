from decimal import Decimal

from rest_framework import serializers

from finanzas.models import MovimientoCaja
from pedidos.models import Estado


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.CharField(max_length=50)
    notas = serializers.CharField(required=False, allow_blank=True)

    def validate_estado(self, value):
        value = value.strip()
        if not Estado.objects.filter(nombre=value).exists():
            raise serializers.ValidationError('El estado indicado no existe.')
        return value


class RegistrarAnticipoSerializer(serializers.Serializer):
    monto = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    metodo = serializers.ChoiceField(
        choices=MovimientoCaja.METODO_CHOICES,
        default='EFECTIVO',
        required=False,
    )
