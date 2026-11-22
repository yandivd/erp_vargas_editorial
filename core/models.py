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


class TarifaMensajeria(models.Model):
    provincia = models.CharField(max_length=100)
    municipio = models.CharField(max_length=100)
    costo = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Tarifa de mensajería'
        verbose_name_plural = 'Tarifas de mensajería'
        unique_together = ('provincia', 'municipio')
        ordering = ['provincia', 'municipio']

    def __str__(self):
        return f"{self.municipio}, {self.provincia}: {self.costo}"