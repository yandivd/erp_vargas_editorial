from django.db import models


class Parametro(models.Model):
    clave = models.CharField(max_length=100, primary_key=True)
    valor = models.DecimalField(max_digits=12, decimal_places=4)
    descripcion = models.CharField(max_length=300, blank=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Parámetro'
        verbose_name_plural = 'Parámetros'

    def __str__(self):
        return f"{self.clave}: {self.valor}"

    @classmethod
    def get(cls, clave, default=None):
        try:
            return cls.objects.get(clave=clave).valor
        except cls.DoesNotExist:
            return default