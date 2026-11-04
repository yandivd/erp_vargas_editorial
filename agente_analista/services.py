import json
import os

from .prompts import SYSTEM_PROMPT
from .tools import TOOLS, ejecutar_herramienta


BASE_URL_DEEPSEEK = 'https://openrouter.ai/api/v1'
MODELO_POR_DEFECTO = 'deepseek/deepseek-chat'
MAX_ITERACIONES = 5


def _crear_cliente():
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            'Falta la dependencia openai. Instala las dependencias del proyecto.'
        ) from exc

    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        raise RuntimeError('Falta configurar la variable de entorno OPENROUTER_API_KEY.')

    return OpenAI(
        api_key=api_key,
        base_url=BASE_URL_DEEPSEEK,
        default_headers={
            'HTTP-Referer': 'http://localhost:8000/',
            'X-Title': 'Vargas ERP - Agente Analista',
        },
    )


def _modelo():
    return os.environ.get('DEEPSEEK_MODEL', MODELO_POR_DEFECTO)


def _argumentos_tool(tool_call):
    try:
        argumentos = json.loads(tool_call.function.arguments or '{}')
    except (TypeError, json.JSONDecodeError):
        return {'error': 'Los argumentos de la herramienta no son JSON válido.'}
    if not isinstance(argumentos, dict):
        return {'error': 'Los argumentos de la herramienta deben ser un objeto JSON.'}
    return argumentos


def _mensaje_asistente(mensaje):
    tool_calls = []
    for llamada in mensaje.tool_calls or []:
        tool_calls.append({
            'id': llamada.id,
            'type': 'function',
            'function': {
                'name': llamada.function.name,
                'arguments': llamada.function.arguments,
            },
        })

    return {
        'role': 'assistant',
        'content': mensaje.content or '',
        'tool_calls': tool_calls,
    }


def _ejecutar_llamada(tool_call):
    argumentos = _argumentos_tool(tool_call)
    if 'error' in argumentos and len(argumentos) == 1:
        return argumentos

    try:
        return ejecutar_herramienta(tool_call.function.name, argumentos)
    except Exception as exc:
        return {'error': str(exc)}


def _primer_mensaje(respuesta):
    if not respuesta.choices:
        raise RuntimeError('DeepSeek no devolvió ninguna respuesta.')
    return respuesta.choices[0].message


def _texto_respuesta(respuesta):
    contenido = _primer_mensaje(respuesta).content
    texto = (contenido or '').strip()
    if not texto:
        raise RuntimeError('DeepSeek devolvió una respuesta vacía.')
    return texto


def ejecutar_agente(mensaje: str) -> str:
    if not isinstance(mensaje, str) or not mensaje.strip():
        raise ValueError('El mensaje no puede estar vacío.')

    cliente = _crear_cliente()
    mensajes = [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': mensaje.strip()},
    ]

    for _ in range(MAX_ITERACIONES):
        respuesta = cliente.chat.completions.create(
            model=_modelo(),
            messages=mensajes,
            tools=TOOLS,
            tool_choice='auto',
            temperature=0.1,
        )
        mensaje_asistente = _primer_mensaje(respuesta)

        if not mensaje_asistente.tool_calls:
            return _texto_respuesta(respuesta)

        mensajes.append(_mensaje_asistente(mensaje_asistente))

        for llamada in mensaje_asistente.tool_calls:
            resultado = _ejecutar_llamada(llamada)
            mensajes.append({
                'role': 'tool',
                'tool_call_id': llamada.id,
                'content': json.dumps(resultado, ensure_ascii=False, default=str),
            })

    mensajes.append({
        'role': 'user',
        'content': (
            'Se alcanzó el límite de consultas a herramientas. '
            'Redacta la respuesta final con los datos obtenidos y no inventes cifras.'
        ),
    })
    respuesta = cliente.chat.completions.create(
        model=_modelo(),
        messages=mensajes,
        temperature=0.1,
    )
    return _texto_respuesta(respuesta)
