import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Borrar los registros de las migraciones que vamos a regenerar
for app, name in [
    ('pedidos', '0001_initial'),
    ('finanzas', '0001_initial'),
]:
    cursor.execute(
        "DELETE FROM django_migrations WHERE app=? AND name=?",
        (app, name)
    )
    print(f"Borrado {app}.{name}: {cursor.rowcount} registros")

conn.commit()
conn.close()
print("Listo.")