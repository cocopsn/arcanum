"use client";

import { useState } from "react";
import { useArcanum, useArcanumSync } from "@/app/providers";
import { getSupabase } from "@/sync/client";

// Cloud-backup sheet. There is NO manual Supabase login anymore (the password is a server secret):
// ONE login — the env-gate — IS the identity. If sync didn't auto-heal on load, this is the manual
// one-tap fallback: the server mints the session from the gate cookie and the client adopts it.
export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut, syncNow } = useArcanumSync();
  const email = useArcanum((s) => s.authEmail);
  const pending = useArcanum((s) => s.pendingCount);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) return null;

  async function activate() {
    setBusy(true);
    setMsg(null);
    try {
      const s = await fetch("/api/session", { cache: "no-store" }).then((r) => r.json());
      if (!s?.configured) {
        setMsg("El respaldo necesita el acceso configurado (ARCANUM_ACCESS_PASSWORD) en el servidor.");
        return;
      }
      if (!s?.authed) {
        setMsg("Primero entra con tu acceso (recarga la app).");
        return;
      }
      const r = await fetch("/api/session/refresh", { method: "POST" }).then((res) => res.json());
      if (r?.ok && r.supabase?.access_token && r.supabase?.refresh_token) {
        await getSupabase().auth.setSession({ access_token: r.supabase.access_token, refresh_token: r.supabase.refresh_token });
        onClose(); // onAuthChange in the provider sets authEmail + syncs
      } else {
        setMsg("El servidor no pudo activar el respaldo (falta SUPABASE_SERVICE_ROLE_KEY en Vercel).");
      }
    } catch {
      setMsg("Sin conexión. Reintenta.");
    } finally {
      setBusy(false);
    }
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
                Un solo titular. La app funciona 100% sin esto; activarlo enciende el espejo cifrado
                para que tu bitácora sobreviva a este dispositivo. No hay segunda contraseña — usa el
                mismo acceso con el que entraste.
              </p>
            </div>
            {msg && (
              <p className="text-sm text-amber" role="status" aria-live="polite">
                {msg}
              </p>
            )}
            <button
              disabled={busy}
              onClick={() => void activate()}
              aria-busy={busy}
              className="min-h-11 w-full rounded-[var(--r-sm)] border border-rank bg-rank-soft px-4 text-sm text-rank transition hover:brightness-125 disabled:opacity-40"
            >
              {busy ? "Activando…" : "Activar respaldo en la nube"}
            </button>
            <button onClick={onClose} className="min-h-11 w-full text-xs uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted">
              Ahora no
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
