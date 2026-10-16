from django.db import models


class Proveedor(models.Model):
    TIPO_CHOICES = [
        ('IMPRENTA_PORTADA', 'Imprenta de portada'),
        ('ENCUADERNADOR', 'Encuadernador'),
        ('PAPELERIA', 'Papelería'),
        ('OTRO', 'Otro'),
    ]
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    telefono = models.CharField(max_length=50, blank=True)
    direccion = models.TextField(blank=True)
    notas = models.TextField(blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()})"