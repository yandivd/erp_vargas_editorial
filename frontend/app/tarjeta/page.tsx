"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";

const STORAGE_KEY = "token_fidelidad";
const ERROR_MESSAGE = "No encontramos una tarjeta con ese número";

type BusquedaResponse = {
  ok?: boolean;
  data?: { token?: string };
  error?: string;
};

export default function TarjetaPage() {
  const router = useRouter();
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem(STORAGE_KEY);

    if (token) {
      router.replace(`/mi-tarjeta/${token}`);
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const telefonoNormalizado = telefono.trim();
    if (telefonoNormalizado.replace(/\D/g, "").length < 6) {
      setError(ERROR_MESSAGE);
      return;
    }

    setEnviando(true);

    try {
      const response = await fetch(
        `/api/tarjeta/buscar?telefono=${encodeURIComponent(telefonoNormalizado)}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as BusquedaResponse;
      const token = payload.data?.token;

      if (!response.ok || !token) {
        throw new Error(payload.error ?? ERROR_MESSAGE);
      }

      window.localStorage.setItem(STORAGE_KEY, token);
      router.replace(`/mi-tarjeta/${token}`);
    } catch {
      setError(ERROR_MESSAGE);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 px-4">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center py-16">
        <div className="w-full rounded-2xl border border-white/10 bg-white p-7 shadow-2xl">
          <div className="text-center">
            <QrCode
              className="mx-auto h-10 w-10 text-brand"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              Mi tarjeta de fidelidad
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Ingresa tu número de teléfono para ver tu tarjeta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="telefono"
                className="mb-1 block text-sm font-semibold text-slate-800"
              >
                Teléfono
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                placeholder="Ej. 51234567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                disabled={enviando}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={enviando}
            >
              {enviando ? "Buscando…" : "Ver mi tarjeta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
