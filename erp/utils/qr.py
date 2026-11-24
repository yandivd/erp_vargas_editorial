import base64
from io import BytesIO

import qrcode
from django.conf import settings
from qrcode.constants import ERROR_CORRECT_M


def generar_qr_png(url):
    qr = qrcode.QRCode(
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    imagen = qr.make_image(fill_color='black', back_color='white')
    buffer = BytesIO()
    imagen.save(buffer, format='PNG')
    return buffer.getvalue()


def generar_qr_base64(token_usuario):
    if not token_usuario:
        return None

    url = f'{settings.FRONTEND_URL}/fidelidad/{token_usuario}/'
    contenido = base64.b64encode(generar_qr_png(url)).decode('ascii')
    return f'data:image/png;base64,{contenido}'
