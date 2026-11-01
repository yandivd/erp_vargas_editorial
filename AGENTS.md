# AGENTS.md

ERP de gestión editorial/encuadernación. Django 5.2 + plantillas server-side + Bootstrap 5 por CDN. UI y textos de negocio en español.

## Comandos

El `venv/` incluido es de **Windows** (Python 3.15, `venv/Scripts`), no funciona en Linux/WSL.

```bash
# Windows, desde la raíz del repo
venv\Scripts\python.exe manage.py runserver
venv\Scripts\python.exe manage.py check
venv\Scripts\python.exe manage.py migrate
venv\Scripts\python.exe manage.py test          # los tests son stubs: no cubren nada real
venv\Scripts\python.exe manage.py depreciar --anio 2026 --mes 11
```

- No hay lint, typecheck ni formateador configurados. Verifica con `manage.py check` y ejecutando la vista.
- En Linux/WSL crea tu propio venv. `requirements.txt` está en UTF-16 LE; si pip falla, conviértelo a UTF-8 primero.
- `.env` (no versionado) se carga con `python-dotenv`. `DEBUG` por defecto es `False`; pon `DEBUG=True` para desarrollo local.

## Arquitectura

- `config/` es el proyecto Django. Las apps de dominio viven en la raíz: `core`, `clientes`, `pedidos`, `inventario`, `proveedores`, `finanzas`, `empleados`, `compras`.
- `templates/` está en la raíz (no dentro de las apps); `static/` solo contiene imágenes, no hay build de JS/CSS ni bundler.
- La lógica de negocio vive en `*/services.py`, no en las vistas. `pedidos/views.py` es el archivo grande; `pedidos/services.py` contiene el costeador y la máquina de estados.
- `config/urls.py`: la inclusión de `pwa.urls` debe seguir antes de las demás rutas para que funcionen manifest/service worker.
- `/api/pedidos/` es un `ModelViewSet` DRF sin permisos explícitos (queda abierto con los defaults).

## Reglas de negocio que no se deducen de los nombres

- `ServicioPedido.cambiar_estado` dispara efectos automáticos según el **nombre exacto** del `Estado`: `Pendiente a Carátula`, `Pendiente a Encuadernado`, `Listo para Entregar`, `Entregado`. Renombrar estados rompe la automatización.
- Los costos/precios se calculan desde `core.models.Parametro` (clave-valor editable en admin). Usa `Parametro.get(clave, default)`.
- `Pedido.save()` siempre recalcula `saldo_pendiente = precio_venta - anticipo_recibido`.
- La "Tienda" (`pedidos:lista_tienda`) muestra `Pedido` con estado `En Stock` y sin cliente; no es un catálogo de `Book`.
- Finanzas maneja dos monedas (`CUP`/`USD`). Al calcular saldos/reportes, excluye las categorías de transferencia (`COMPRA_DIVISA`, `VENTA_DIVISA`) y usa `ServicioFinanzas.saldo_caja(moneda)`.
- `core.views.dashboard` cachea el contexto 5 minutos por filtro de fechas; si cambias datos y no ves KPIs actualizados, limpia la caché.
- Zona horaria `America/Havana` con `USE_TZ=True`: usa `timezone.now()`/`localtime`, no `datetime.now()`.

## Gotchas del repo

- **Line endings:** ~158 archivos versionados aparecen como modificados en `git status` solo por CRLF en el working tree. `git diff` muestra el archivo completo. Nunca uses `git add -A`/`git commit -a`; stagea solo lo que tocaste.
- **Migraciones ignoradas:** `pedidos/migrations/0012_pedido_es_historico.py` y `finanzas/migrations/0012_alter_movimientocaja_categoria.py` están en `.gitignore` aunque los modelos dependen de ellas. No las borres y no asumas que un clone nuevo tiene el esquema al día.
- **Menú duplicado:** `templates/base.html` repite los enlaces en el sidebar de escritorio y en el offcanvas móvil. Cualquier enlace nuevo debe agregarse en **ambos**.
- **App Android:** `capacitor.config.json` apunta a `https://vargaserp.pythonanywhere.com` y `www/` está vacío. La APK es un wrapper del sitio remoto: los cambios de templates no se ven en la app hasta desplegar el servidor.
- **Scripts de raíz:** `inicializar_db.py` borra datos y usa categorías obsoletas; `limpiar_migraciones.py` elimina registros de migraciones. Son utilidades de un solo uso, no las ejecutes en producción ni sin revisar.
