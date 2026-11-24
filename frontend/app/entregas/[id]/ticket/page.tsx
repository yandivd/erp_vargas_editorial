import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import type { EntregaDetail } from "@/lib/entregas";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Entrega #${id}` };
}

function fechaHoy(): string {
  return new Intl.DateTimeFormat("es-CU", {
    timeZone: "America/Havana",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function referenciaPedido(
  referencia: string | null | undefined,
  id: number,
): string {
  const ref = String(referencia || "").trim();
  return ref || String(id);
}

function floatformat0(value: string | number | null | undefined): string {
  return String(Math.round(Number(value ?? 0)));
}

function floatformat2(value: string | number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

const printStyles = `
  @page {
    size: 58mm auto;
    margin: 0;
  }

  body, div, p, span, table, th, td {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: auto !important;
    min-height: 100% !important;
    overflow-y: auto !important;
  }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    text-transform: uppercase;
    color: #000;
    background: #ffffff;
    width: 100%;
  }

  .hoja {
    width: 100%;
    height: auto !important;
  }

  .etiqueta {
    width: 100%;
    background: #ffffff;
    padding: 2mm;
    display: flex;
    flex-direction: column;
    font-size: 24px;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }

  .etq-header {
    text-align: center;
    border-bottom: 3px dashed #000;
    padding-bottom: 2mm;
    margin-bottom: 2mm;
    page-break-after: avoid;
  }

  .etq-logo {
    height: 80px;
    width: auto;
    max-width: 90%;
    margin-bottom: 10px;
    display: inline-block;
  }

  .etq-empresa {
    font-size: 32px !important;
    font-weight: 900;
  }

  .etq-sub {
    font-size: 22px !important;
  }

  .etq-cuerpo p {
    font-size: 24px !important;
    margin-bottom: 4px;
    display: block;
  }

  .etq-tabla {
    width: 100%;
    border-collapse: collapse;
    margin: 3mm 0;
  }

  .etq-tabla th {
    font-size: 24px !important;
    text-align: left;
    border-bottom: 3px solid #000;
    border-top: 3px solid #000;
    padding: 1.5mm 0;
  }

  .etq-tabla td {
    font-size: 24px !important;
    padding: 1.5mm 0;
    vertical-align: top;
    word-wrap: break-word;
    word-break: break-word;
  }

  .etq-tabla .right { text-align: right; }
  .etq-tabla .center { text-align: center; }

  .etq-totales {
    border-top: 3px dashed #000;
    padding-top: 2mm;
    margin-top: 2mm;
  }

  .etq-totales .fila span {
    font-size: 24px !important;
    display: inline-block;
  }

  .etq-totales .fila {
    display: flex;
    justify-content: space-between;
    margin: 2mm 0;
  }

  .etq-totales .fila.total-final span {
    font-size: 32px !important;
    font-weight: 900;
  }

  .etq-totales .fila.total-final {
    border-top: 3px solid #000;
    padding-top: 2mm;
    margin-top: 2mm;
  }

  .etq-qr { margin-top: 4mm; padding-top: 3mm; border-top: 3px dashed #000; text-align: center; page-break-inside: avoid; break-inside: avoid; }
  .etq-qr-img { width: 45mm; height: 45mm; display: block; margin: 0 auto 2mm auto; image-rendering: pixelated; }
  .etq-qr-texto { font-size: 16px !important; font-weight: bold; text-align: center; }
`;

export default async function TicketEntregaPage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<EntregaDetail>(
    `entregas/${encodeURIComponent(id)}`,
  )
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar el comprobante de entrega.",
    }));

  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <strong>No se pudo cargar el comprobante.</strong>
            <div>{result.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const entrega = result.data;
  const direccion = entrega.direccion || entrega.cliente_direccion || "—";
  const fechaEntrega = formatDate(entrega.fecha_entrega) || "—";
  const totalDescuento = Number(entrega.total_descuento ?? 0);
  const numero = String(entrega.id).padStart(5, "0");

  return (
    <>
      <style>{printStyles}</style>
      <div className="hoja">
        <div className="etiqueta">
          <div className="etq-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo.png" alt="Logo" className="etq-logo" />
            <p className="etq-empresa">Vargas Editorial</p>
            <p className="etq-sub">Tel: +53 54545068</p>
            <p className="etq-sub" style={{ color: "#c0392b" }}>
              Comprobante de Entrega
            </p>
            <p className="etq-sub">
              No. {numero} | Fecha: {fechaHoy()}
            </p>
          </div>

          <div className="etq-cuerpo">
            <p>
              <strong>Cliente:</strong> {entrega.cliente_nombre}
            </p>
            <p>
              <strong>Tel:</strong> {entrega.cliente_telefono || "—"}
            </p>
            <p>
              <strong>Dir:</strong> {direccion}
            </p>
            <p>
              <strong>Entrega:</strong> {fechaEntrega} ({entrega.cantidad_pedidos}{" "}
              ped.)
            </p>

            <table className="etq-tabla">
              <thead>
                <tr>
                  <th style={{ width: "15%", textAlign: "left" }}>Ref</th>
                  <th className="center" style={{ width: "60%" }}>
                    Libro
                  </th>
                  <th className="right" style={{ width: "25%" }}>
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {entrega.pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td style={{ textAlign: "left" }}>
                      {referenciaPedido(pedido.referencia_externa, pedido.id)}
                    </td>
                    <td className="center">{pedido.libro_titulo}</td>
                    <td className="right">
                      ${floatformat0(pedido.saldo_pendiente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="etq-totales">
            {totalDescuento > 0 ? (
              <>
                <div className="fila" style={{ color: "#27ae60" }}>
                  <span>Descuento:</span>
                  <span>-${floatformat0(totalDescuento)}</span>
                </div>
                <div className="fila">
                  <span>Subtotal:</span>
                  <span>${floatformat0(entrega.total_pedidos)}</span>
                </div>
              </>
            ) : (
              <div className="fila">
                <span>Total Pedidos:</span>
                <span>${floatformat0(entrega.total_pedidos)}</span>
              </div>
            )}

            <div className="fila">
              <span>Anticipos:</span>
              <span>-${floatformat0(entrega.total_anticipos)}</span>
            </div>
            <div className="fila">
              <span>Mensajería:</span>
              <span>
                {entrega.entregado
                  ? "Entregada"
                  : `$${floatformat0(entrega.costo_mensajeria)}`}
              </span>
            </div>

            <div className="fila total-final" style={{ color: "#c0392b" }}>
              <span>Total a Cobrar:</span>
              <span>${floatformat2(entrega.total_pendiente)}</span>
            </div>
          </div>

          {entrega.qr_imagen ? (
            <div className="etq-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entrega.qr_imagen}
                alt="QR tarjeta cliente"
                className="etq-qr-img"
              />
              <p className="etq-qr-texto">
                Escanea para ver tu tarjeta de cliente
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
