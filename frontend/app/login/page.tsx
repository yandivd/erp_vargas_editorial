"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const payload: LoginResponse | null = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col bg-slate-100 md:flex-row">
      <section className="hidden min-h-screen items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 px-8 py-12 text-white md:flex md:w-2/5">
        <div className="max-w-sm text-center">
          <Image
            src="/img/logo.jpg"
            alt="Vargas Editorial"
            width={260}
            height={120}
            priority
            className="h-auto max-h-40 w-full object-contain"
          />
          <p className="mt-4 text-sm text-slate-300">
            Gestión editorial y encuadernación.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12 md:w-3/5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-8 text-center md:text-left">
            <Image
              src="/img/logo.jpg"
              alt="Vargas Editorial"
              width={200}
              height={108}
              priority
              className="mx-auto mb-4 h-auto w-40 object-contain md:hidden"
            />
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-slate-600">Accede con tu usuario del sistema.</p>
          </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Usuario
            </label>
            <div className="relative">
              <UserRound
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-line bg-white pl-10 pr-3 py-2 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400/20 dark:disabled:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-line bg-white pl-10 pr-12 py-2 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-400/20 dark:disabled:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Iniciando sesión...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <div className="mt-4 text-center">
            <Link
              href="/catalogo"
              className="text-sm font-medium text-brand transition hover:text-brand-dark"
            >
              Ver catálogo público
            </Link>
          </div>
          </form>
        </div>
      </section>
    </main>
  );
}
