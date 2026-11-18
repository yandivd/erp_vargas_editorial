PROVINCIAS = (
    'La Habana',
    'Artemisa',
)

MUNICIPIOS_POR_PROVINCIA = {
    'La Habana': (
        'Arroyo Naranjo',
        'Boyeros',
        'Centro Habana',
        'Cerro',
        'Cotorro',
        'Diez de Octubre',
        'Guanabacoa',
        'Habana del Este',
        'La Habana Vieja',
        'La Lisa',
        'Marianao',
        'Playa',
        'Plaza de la Revolución',
        'Regla',
        'San Miguel del Padrón',
    ),
    'Artemisa': (
        'Alquízar',
        'Artemisa',
        'Bahía Honda',
        'Bauta',
        'Caimito',
        'Candelaria',
        'Guanajay',
        'Güira de Melena',
        'Mariel',
        'San Antonio de los Baños',
        'San Cristóbal',
    ),
}

MUNICIPIOS = tuple(
    municipio
    for municipios in MUNICIPIOS_POR_PROVINCIA.values()
    for municipio in municipios
)
