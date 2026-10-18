from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib import colors

def crear_manual():
    doc = SimpleDocTemplate("Manual_ERP_Libros.pdf", pagesize=letter,
                            rightMargin=inch, leftMargin=inch,
                            topMargin=inch, bottomMargin=inch)
    
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    titulo_principal = ParagraphStyle(
        'TituloPrincipal',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=30,
        alignment=1 # Centrado
    )
    
    subtitulo = ParagraphStyle(
        'Subtitulo',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor("#3b82f6"),
        spaceBefore=20,
        spaceAfter=10
    )
    
    texto_normal = ParagraphStyle(
        'TextoNormal',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=10,
        leading=14
    )
    
    paso_lista = ParagraphStyle(
        'PasoLista',
        parent=styles['Normal'],
        fontSize=11,
        leftIndent=20,
        spaceAfter=5,
        bulletIndent=10
    )

    Story = []

    # ==========================================
    # PORTADA
    # ==========================================
    Story.append(Spacer(1, 2 * inch))
    Story.append(Paragraph("Manual de Usuario", titulo_principal))
    Story.append(Paragraph("Sistema ERP para Taller de Encuadernación", subtitulo))
    Story.append(Spacer(1, 0.5 * inch))
    Story.append(Paragraph("<i>Guía paso a paso para la gestión diaria del negocio</i>", texto_normal))
    Story.append(PageBreak())

    # ==========================================
    # 1. FLUJO DIARIO (PEDIDOS POR ENCARGO)
    # ==========================================
    Story.append(Paragraph("1. Flujo Diario: Pedidos por Encargo", subtitulo))
    Story.append(Paragraph("Este es el proceso principal cuando un cliente te pide un libro que no tienes en stock.", texto_normal))
    
    Story.append(Paragraph("<b>Paso 1: Recibir al Cliente</b>", texto_normal))
    Story.append(Paragraph("• Si es un cliente nuevo, ve a <b>Clientes -> Nuevo Cliente</b> y registra su nombre y teléfono.", paso_lista))
    
    Story.append(Paragraph("<b>Paso 2: Crear el Pedido</b>", texto_normal))
    Story.append(Paragraph("• Ve a <b>Pedidos -> Nuevo Pedido</b>.", paso_lista))
    Story.append(Paragraph("• Selecciona el cliente. Si el libro no existe en el catálogo, escribe el título, autor y páginas. El sistema calculará el precio automáticamente.", paso_lista))
    Story.append(Paragraph("• El pedido nace en estado <b>'Borrador'</b>.", paso_lista))
    
    Story.append(Paragraph("<b>Paso 3: Confirmar y Cobrar Anticipo</b>", texto_normal))
    Story.append(Paragraph("• Cuando el cliente confirme, cambia el estado a <b>'Pendiente a Anticipo'</b>.", paso_lista))
    Story.append(Paragraph("• Cuando te pague, usa el botón <b>'Registrar Anticipo'</b>. La fecha de entrega se calculará automáticamente (+28 días).", paso_lista))
    
    Story.append(Paragraph("<b>Paso 4: Producción</b>", texto_normal))
    Story.append(Paragraph("• Avanza el pedido por los estados: <i>Pendiente a Impresión -> Impreso -> Pegado -> Pendiente a Portada -> Pendiente a Carátula -> Pendiente a Encuadernado -> Listo para Entregar</i>.", paso_lista))
    Story.append(Paragraph("• El sistema descontará los materiales del inventario automáticamente y creará las deudas con tus proveedores.", paso_lista))
    
    Story.append(Paragraph("<b>Paso 5: Entrega y Cobro Final</b>", texto_normal))
    Story.append(Paragraph("• Cuando el cliente venga a buscar el libro, cobra el saldo pendiente.", paso_lista))
    Story.append(Paragraph("• Cambia el estado a <b>'Entregado'</b>. El dinero entrará a tu caja y el pedido se cerrará.", paso_lista))
    Story.append(Spacer(1, 20))

    # ==========================================
    # 2. FABRICACIÓN PARA STOCK (VENTA DIRECTA)
    # ==========================================
    Story.append(Paragraph("2. Flujo: Fabricar para Stock", subtitulo))
    Story.append(Paragraph("Cuando decides fabricar un libro por tu cuenta para tenerlo en el estante y venderlo después.", texto_normal))
    
    Story.append(Paragraph("• Ve al <b>Catálogo</b> y busca el libro. Haz clic en <b>'Fabricar para Stock'</b>.", paso_lista))
    Story.append(Paragraph("• Esto crea un pedido sin cliente. Pásalo por todo el proceso de producción (Impreso, Pegado, etc.).", paso_lista))
    Story.append(Paragraph("• Cuando esté <b>'Listo para Entregar'</b>, el libro estará físicamente en tu mesa.", paso_lista))
    Story.append(Paragraph("• <b>Cuando llegue un cliente a comprarlo:</b> Abre el pedido y haz clic en el botón verde <b>'Asignar Cliente y Cobrar'</b>. El sistema cobrará el 100% del valor y cerrará la venta.", paso_lista))
    Story.append(Spacer(1, 20))

    # ==========================================
    # 3. INVENTARIO Y COMPRAS
    # ==========================================
    Story.append(Paragraph("3. Gestión de Inventario y Compras", subtitulo))
    
    Story.append(Paragraph("<b>Compras Formales (Proveedores)</b>", texto_normal))
    Story.append(Paragraph("• Ve a <b>Compras -> Nueva Compra</b>. Selecciona el proveedor y los materiales que necesitas.", paso_lista))
    Story.append(Paragraph("• Imprime la Orden de Compra y llévala al proveedor.", paso_lista))
    Story.append(Paragraph("• Cuando el proveedor te entregue el material y le pagues, entra al sistema y haz clic en <b>'Recibir Material'</b>. El stock entrará al almacén y el dinero saldrá de tu caja.", paso_lista))
    
    Story.append(Paragraph("<b>Mermas y Daños</b>", texto_normal))
    Story.append(Paragraph("• Si un material se daña, ve al <b>Inventario -> Historial del Material</b> y usa el botón amarillo <b>'Registrar Merma'</b>. Esto ajustará tu stock y registrará la pérdida.", paso_lista))
    Story.append(Spacer(1, 20))

    # ==========================================
    # 4. FINANZAS Y SALARIOS
    # ==========================================
    Story.append(Paragraph("4. Finanzas, Nómina y Utilidades", subtitulo))
    
    Story.append(Paragraph("<b>Pago de Nómina</b>", texto_normal))
    Story.append(Paragraph("• Ve a <b>Nómina</b>. Paga el salario mensual a ti y a tu esposa (Tipo: Salario). Esto se registrará como gasto operativo del negocio.", paso_lista))
    
    Story.append(Paragraph("<b>Termómetro Financiero (Retiro de Utilidades)</b>", texto_normal))
    Story.append(Paragraph("• En la misma pantalla de Nómina, verás una tarjeta verde que dice <b>'¿Cuánto puedo retirar como Dueño?'</b>.", paso_lista))
    Story.append(Paragraph("• El sistema calcula tu caja libre restando las deudas y el fondo de reserva. Si el número es mayor a 0, puedes pagarte esas utilidades.", paso_lista))
    Story.append(Paragraph("• Regístralo como un pago en Nómina, pero seleccionando el tipo <b>'Retiro de Utilidades'</b>. Así el dinero sale de la caja pero no afecta la ganancia del negocio.", paso_lista))
    Story.append(Spacer(1, 20))

    # ==========================================
    # 5. LOS BADGES DE CLIENTES
    # ==========================================
    Story.append(Paragraph("5. Inteligencia de Clientes (Badges)", subtitulo))
    Story.append(Paragraph("Tu sistema clasifica a los clientes de forma automática. Úsalos para hacer campañas:", texto_normal))
    Story.append(Paragraph("• 👑 <b>En riesgo (90+ días):</b> Llámalos o envíales un WhatsApp para recuperarlos.", paso_lista))
    Story.append(Paragraph("• 🥶 <b>Inactivo 60 días:</b> Ofréceles un pequeño descuento o novedades.", paso_lista))
    Story.append(Paragraph("• 😴 <b>Inactivo 30 días:</b> Recuérdales que estás disponible.", paso_lista))
    Story.append(Paragraph("• 👑 <b>VIP (+10 libros):</b> Consiéntelos, son tu mejor fuente de ingresos.", paso_lista))
    Story.append(Paragraph("• 💎 <b>Alto valor (+5 libros):</b> Ofréceles preventas exclusivas.", paso_lista))
    Story.append(Paragraph("• 🔥 <b>Recurrente activo:</b> Mantén la comunicación.", paso_lista))
    Story.append(Paragraph("• 🆕 <b>Nuevo:</b> Envíales un mensaje de agradecimiento.", paso_lista))

    doc.build(Story)
    print("✅ Manual generado con éxito: Manual_ERP_Libros.pdf")

if __name__ == "__main__":
    crear_manual()