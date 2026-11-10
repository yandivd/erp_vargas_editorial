import { AlertTriangle } from "lucide-react";
import TicketActions from "@/components/entregas/TicketActions";
import { apiFetch } from "@/lib/api";
import type { EntregaDetail } from "@/lib/entregas";
import { formatDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
  const refStr = String(referencia || "");
  return refStr.trim() ? refStr : String(id);
}

export default async function TicketEntregaPage({ params }: PageProps) {
  const { id } = await params;
  const result = await apiFetch<EntregaDetail>(
    `entregas/${encodeURIComponent(id)}/`,
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
  const direccion =
    entrega.direccion || entrega.cliente_direccion || "—";
  const fechaEntrega = formatDate(entrega.fecha_entrega) || "—";

  return (
    <div className="ticket-preview">
      <style>{`
        @page {
          size: 58mm auto;
          margin: 0;
        }

        .ticket-preview {
          min-height: 100vh;
          padding: 16px;
          background: #e2e8f0;
        }

        .ticket {
          width: 58mm;
          max-width: 100%;
          margin: 0 auto;
          padding: 2mm;
          background: #fff;
          color: #000;
          font-family: 'Courier New', Courier, monospace;
          font-size: 8pt;
          font-weight: bold;
          line-height: 1.3;
          text-transform: uppercase;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
        }

        .ticket-center {
          text-align: center;
        }

        .ticket-logo {
          display: block;
          width: 34mm;
          max-width: 90%;
          max-height: 20mm;
          margin: 0 auto 2mm;
          object-fit: contain;
          filter: grayscale(1);
        }

        .ticket-empresa {
          margin: 0;
          font-size: 12pt;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .ticket-sub {
          margin: 0.6mm 0;
          font-size: 8pt;
        }

        .ticket-titulo {
          margin: 1.5mm 0 0.8mm;
          padding: 1mm 0;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-size: 9.5pt;
          font-weight: 900;
        }

        .ticket-sep {
          margin: 2mm 0;
          border-top: 1px dashed #000;
        }

        .ticket-sep-doble {
          margin: 2mm 0;
          border-top: 2px solid #000;
        }

        .ticket-cuerpo p {
          margin: 0 0 0.8mm;
          font-size: 8pt;
        }

        .ticket-tabla {
          width: 100%;
          margin: 2mm 0;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 7pt;
        }

        .ticket-tabla th,
        .ticket-tabla td {
          padding: 0.9mm 0.4mm;
          vertical-align: top;
          word-break: break-word;
        }

        .ticket-tabla th {
          border-top: 1.5px solid #000;
          border-bottom: 1.5px solid #000;
          font-size: 6.8pt;
          text-align: left;
        }

        .ticket-tabla td {
          border-bottom: 1px dotted #000;
        }

        .ticket-tabla .ref {
          width: 16%;
          text-align: left;
        }

        .ticket-tabla .libro {
          width: 34%;
          text-align: left;
        }

        .ticket-tabla .cant {
          width: 8%;
          text-align: center;
        }

        .ticket-tabla .precio,
        .ticket-tabla .saldo {
          width: 21%;
          text-align: right;
        }

        .ticket-totales {
          margin-top: 2mm;
          padding-top: 2mm;
          border-top: 1px dashed #000;
        }

        .ticket-fila {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          margin: 1mm 0;
          font-size: 8pt;
        }

        .ticket-fila.total-final {
          margin-top: 1.5mm;
          padding-top: 1.5mm;
          border-top: 2px solid #000;
          font-size: 10pt;
          font-weight: 900;
        }

        .ticket-nota,
        .ticket-footer {
          margin: 1.5mm 0 0;
          text-align: center;
          font-size: 7pt;
        }

        .ticket-footer {
          margin-top: 3mm;
        }

        .ticket-firma {
          margin: 2mm auto 0;
          width: 80%;
          border-top: 1px solid #000;
          padding-top: 1mm;
          text-align: center;
          font-size: 7pt;
        }

        @media print {
          html,
          body {
            min-height: 0 !important;
            background: #fff !important;
          }

          .no-print {
            display: none !important;
          }

          .ticket-preview {
            min-height: 0;
            padding: 0;
            background: #fff;
          }

          .ticket {
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 2mm;
            box-shadow: none;
          }
        }
      `}</style>

      <TicketActions />

      <article className="ticket">
        <header className="ticket-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo.jpg"
            alt="Vargas Editorial"
            className="ticket-logo"
          />
          <p className="ticket-sub">Libros por encargo y encuadernación</p>
          <p className="ticket-sub">Tel: +53 54545068</p>
          <p className="ticket-sub">Artemisa, Cuba</p>
          <p className="ticket-titulo">Comprobante de Entrega</p>
          <p className="ticket-sub">
            No. {String(entrega.id).padStart(5, "0")} | Fecha: {fechaHoy()}
          </p>
        </header>

        <div className="ticket-sep" />

        <section className="ticket-cuerpo">
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
            <strong>Entrega:</strong> {fechaEntrega} (
            {entrega.cantidad_pedidos} ped.)
          </p>
        </section>

        <table className="ticket-tabla">
          <thead>
            <tr>
              <th className="ref">Ref</th>
              <th className="libro">Libro</th>
              <th className="cant">C</th>
              <th className="precio">Precio</th>
              <th className="saldo">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {entrega.pedidos.length === 0 ? (
              <tr>
                <td colSpan={5} className="ticket-center">
                  Sin pedidos asociados
                </td>
              </tr>
            ) : (
              entrega.pedidos.map((pedido) => (
                <tr key={pedido.id}>
                  <td className="ref">
                    {referenciaPedido(pedido.referencia_externa, pedido.id)}
                  </td>
                  <td className="libro">{pedido.libro_titulo}</td>
                  <td className="cant">{pedido.cantidad}</td>
                  <td className="precio">{money(pedido.precio_venta)}</td>
                  <td className="saldo">{money(pedido.saldo_pendiente)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ticket-totales">
          <div className="ticket-fila">
            <span>Total Pedidos:</span>
            <span>{money(entrega.total_pedidos)}</span>
          </div>
          <div className="ticket-fila">
            <span>Anticipos:</span>
            <span>-{money(entrega.total_anticipos)}</span>
          </div>
          <div className="ticket-fila">
            <span>Mensajería:</span>
            <span>{money(entrega.costo_mensajeria)}</span>
          </div>
          <div className="ticket-fila total-final">
            <span>Total a Cobrar:</span>
            <span>{money(entrega.total_a_cobrar)}</span>
          </div>
        </div>

        <div className="ticket-sep-doble" />


        <footer className="ticket-footer">
          <p>Gracias por confiar en nosotros</p>
        </footer>
      </article>
    </div>
  );
}
