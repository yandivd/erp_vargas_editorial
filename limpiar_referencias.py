from pedidos.models import Pedido
import re

pedidos = Pedido.objects.exclude(referencia_externa__isnull=True)

actualizados = 0
a_null = 0
duplicados = []
errores = []

for p in pedidos:
    ref = p.referencia_externa

    if isinstance(ref, int):
        continue

    if isinstance(ref, str):
        ref_limpia = ref.strip()
        numero = None

        match = re.match(r'^EXCEL-(\d+)$', ref_limpia, re.IGNORECASE)
        if match:
            numero = int(match.group(1))
        elif ref_limpia.isdigit():
            numero = int(ref_limpia)

        if numero is not None:
            if Pedido.objects.filter(referencia_externa=numero).exclude(id=p.id).exists():
                duplicados.append((p.id, ref, numero))
                p.referencia_externa = None
                p.save(update_fields=['referencia_externa'])
                a_null += 1
            else:
                p.referencia_externa = numero
                p.save(update_fields=['referencia_externa'])
                actualizados += 1
        else:
            p.referencia_externa = None
            p.save(update_fields=['referencia_externa'])
            a_null += 1
            errores.append((p.id, ref))

print(f'Actualizados: {actualizados}')
print(f'Puestos en NULL: {a_null}')
if duplicados:
    print('Duplicados detectados (puestos en NULL):')
    for pid, ref, num in duplicados:
        print(f'  Pedido {pid}: {ref!r} -> ya existía {num}')
if errores:
    print('Referencias no reconocidas (puestas en NULL):')
    for pid, ref in errores:
        print(f'  Pedido {pid}: {ref!r}')