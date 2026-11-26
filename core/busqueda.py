import unicodedata

from django.db.models import Value
from django.db.models.functions import Lower, Replace


REEMPLAZOS_BUSQUEDA = (
    ('á', 'a'), ('Á', 'a'),
    ('é', 'e'), ('É', 'e'),
    ('í', 'i'), ('Í', 'i'),
    ('ó', 'o'), ('Ó', 'o'),
    ('ú', 'u'), ('Ú', 'u'),
    ('ü', 'u'), ('Ü', 'u'),
    ('ñ', 'n'), ('Ñ', 'n'),
)


def normalizar_busqueda(valor):
    texto = unicodedata.normalize('NFKD', str(valor or ''))
    texto = ''.join(caracter for caracter in texto if not unicodedata.combining(caracter))
    return texto.lower()


def expresion_busqueda(campo):
    expresion = Lower(campo)
    for original, reemplazo in REEMPLAZOS_BUSQUEDA:
        expresion = Replace(expresion, Value(original), Value(reemplazo))
    return expresion
