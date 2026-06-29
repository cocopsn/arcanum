"use client";

import { useState } from "react";
import { useArcanum, useArcanumSync } from "@/app/providers";

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, signUp, signOut, syncNow } = useArcanumSync();
  const email = useArcanum((s) => s.authEmail);
  const pending = useArcanum((s) => s.pendingCount);
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  if (!open) return null;

  async function submit(mode: "in" | "up") {
    if (!emailInput.trim() || !password) return;
    setBusy(true);
    setMsg(null);
    const res =
      mode === "in"
        ? await signIn(emailInput.trim(), password)
        : await signUp(emailInput.trim(), password);
    setBusy(false);
    if (res.error) setMsg({ kind: "error", text: res.error });
    else if (res.info) setMsg({ kind: "info", text: res.info });
    else onClose(); // session established → provider syncs on auth change
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {email ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-lg text-rank">Respaldo activo</h2>
              <p className="mt-1 text-sm text-text-muted">
                Conectado como <span className="text-text">{email}</span>. Tu bitácora
                vive local y se espeja cifrada en tránsito; RLS garantiza que solo tú la lees.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  syncNow();
                  onClose();
                }}
                className="min-h-11 rounded-[var(--r-sm)] border border-rank px-4 py-2 text-sm text-rank transition hover:bg-rank-soft"
              >
                Sincronizar ahora{pending > 0 ? ` · ${pending} por subir` : ""}
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="min-h-11 px-4 py-2 text-sm text-text-muted transition hover:text-text"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-lg text-rank">Respaldar en la nube</h2>
              <p className="mt-1 text-sm text-text-muted">
                Un solo titular. La app funciona 100% sin esto; entrar solo activa el
                espejo cifrado para que tu log sobreviva a este dispositivo.
              </p>
            </div>
            <input
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-ink px-3 text-text placeholder:text-text-faint focus:border-rank focus:outline-none"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-ink px-3 text-text placeholder:text-text-faint focus:border-rank focus:outline-none"
            />
            {msg && (
              <p className={`text-sm ${msg.kind === "error" ? "text-amber" : "text-topic"}`}>
                {msg.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || !emailInput.trim() || !password}
                onClick={() => submit("in")}
                className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-rank bg-rank-soft px-4 text-sm text-rank transition hover:brightness-125 disabled:opacity-40"
              >
                Entrar
              </button>
              <button
                disabled={busy || !emailInput.trim() || !password}
                onClick={() => submit("up")}
                className="min-h-11 rounded-[var(--r-sm)] border border-line px-4 text-sm text-text-muted transition hover:text-text disabled:opacity-40"
              >
                Crear cuenta
              </button>
            </div>
            <button onClick={onClose} className="min-h-11 w-full text-xs uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted">
              Ahora no
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
