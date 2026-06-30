"use client";

import { useEffect, useRef, useState } from "react";

// Single-user ACCESS GATE. Checks /api/session (cookie validated server-side against the env
// password). Not configured (no env var, e.g. local dev) → gate is OPEN. Offline → trusts the
// localStorage flag set after a prior successful login, so the PWA still opens on the plane.
type Phase = "checking" | "in" | "out";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let cancel = false;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { authed?: boolean; configured?: boolean }) => {
        if (cancel) return;
        if (!d.configured) return setPhase("in"); // no password configured → no gate (dev)
        if (d.authed) {
          localStorage.setItem("arcanum_authed", "1");
          return setPhase("in");
        }
        setPhase("out");
      })
      .catch(() => {
        if (cancel) return;
        // offline: trust the device's prior successful login
        setPhase(localStorage.getItem("arcanum_authed") === "1" ? "in" : "out");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (phase === "checking") {
    return <main className="grid min-h-screen place-items-center font-display text-sm tracking-[0.4em] text-text-faint">ARCANUM</main>;
  }
  if (phase === "out") {
    return (
      <LoginScreen
        onIn={() => {
          localStorage.setItem("arcanum_authed", "1");
          setPhase("in");
        }}
      />
    );
  }
  return <>{children}</>;
}

function LoginScreen({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || !email.trim() || !password) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) onIn();
      else setError(d.error ?? "No se pudo entrar.");
    } catch {
      setError("Sin conexión. Revisa tu red.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6" style={{ background: "linear-gradient(170deg, var(--ink), var(--surface))" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 55% at 50% -8%, var(--rank-soft), transparent 60%)" }} />
      <form onSubmit={submit} className="relative w-full max-w-[320px] text-center" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div aria-hidden className="font-display text-3xl" style={{ color: "var(--rank)", textShadow: "0 0 18px var(--rank-glow)" }}>✶</div>
        <h1 className="mt-3 font-display text-2xl tracking-[0.4em] text-text">ARCANUM</h1>
        <p className="mt-1 font-serif text-[12px] italic text-text-muted">el régimen es de uno solo</p>

        <div className="mt-7 space-y-2 text-left">
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo"
            aria-label="Correo"
            className="min-h-12 w-full rounded-[var(--r-sm)] border border-line bg-surface px-4 text-[15px] text-text placeholder:text-text-faint focus:outline-none focus:ring-1"
            style={{ borderColor: "var(--line)" }}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="clave"
            aria-label="Clave"
            className="min-h-12 w-full rounded-[var(--r-sm)] border border-line bg-surface px-4 text-[15px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          aria-busy={busy}
          className="mt-4 min-h-12 w-full rounded-[var(--r-sm)] border font-display text-sm uppercase tracking-[0.24em] transition hover:brightness-125 disabled:opacity-40"
          style={{ borderColor: "var(--rank)", color: "var(--rank)" }}
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>

        <div role="status" aria-live="polite" className="mt-3 min-h-5 text-[12px]" style={{ color: "var(--amber)" }}>
          {error}
        </div>
      </form>
    </main>
  );
}
