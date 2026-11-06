"use client";

import { useEffect, useMemo, useState } from "react";
import { ENTREGA_KEYS, type EntregaKey, type Json } from "@/core/event";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { submitForgeVerdict, type ForgeApoyo, type ForgeScope, type ForgeSubmitResult } from "@/forge/ai-port";
import { ensureForgeBank, loadForgeBankItems } from "@/forge/loaders";
import { missionConfigError, type FlowProps } from "@/forge/ui/flow-contract";
import { useActions } from "@/ui/use-actions";

// ForgeMission (design §8.3, §9.5): the ONLY component that asks for a gate verdict, in this fixed order:
// (1) the entrega in full or artifact mode, with `apoyo` and scope WITHOUT a default value; (2) await
// mission.submitted { notes, entrega, apoyo } — it does not advance if the write fails; (3) the bank's giro is
// revealed only now, after the entrega (D12), and its answer is recorded; (4) «Pedir veredicto». Without the
// route's bank on this device nothing is graded (M2): the verdict is not offered and the reason is shown.

export const ENTREGA_LABELS: Record<EntregaKey, string> = {
  problema: "Problema",
  supuestos: "Supuestos",
  enfoque: "Enfoque",
  implementacion: "Implementación",
  pruebas: "Pruebas",
  complejidad: "Complejidad",
  fallos: "Fallos",
  herramientas: "Herramientas y ayuda utilizadas",
  defensa: "Defensa",
};
export const ARTEFACTO_TEXT = "ver el artefacto adjunto";
const ARTEFACTO_KEYS: EntregaKey[] = ["herramientas", "defensa"];
const MAX_SECTION = 8_000;
const MAX_TOTAL = 40_000;
const MOTIVO_SIN_BANCO = "falta el banco de la ruta en este dispositivo: descárgalo";

type Bank = { giro: { itemId: string; texto: string } | null } | "cargando" | "sin-banco";

function resultText(r: ForgeSubmitResult): string {
  if (r.estado === "acunado") return "Veredicto registrado en el log.";
  if (r.estado === "en-cola") return `En cola: ${r.motivo}. Encolar no abre nada; el veredicto real decide.`;
  return `El envío no se pudo evaluar: ${r.detalle || r.error}. Vuelve a entregar.`;
}

export default function ForgeMission({ cellCode, cellId, route, kind, attachments, onClose }: FlowProps) {
  const { fire } = useActions();
  const cell = route.cells.find((c) => c.code === cellCode) ?? null;
  const mode: "completo" | "artefacto" = kind === "mision" ? "completo" : "artefacto";
  const configError = cell ? missionConfigError(cell.compuerta, kind, mode, attachments) : "Este flujo no está bien configurado";
  useEffect(() => {
    if (configError) console.error(`ForgeMission ${cellCode}: ${configError} (kind=${String(kind)})`);
  }, [configError, cellCode, kind]);

  const keys = useMemo<EntregaKey[]>(() => (mode === "completo" ? [...ENTREGA_KEYS] : ARTEFACTO_KEYS), [mode]);
  const [text, setText] = useState<Partial<Record<EntregaKey, string>>>({});
  const [apoyo, setApoyo] = useState<ForgeApoyo | null>(null);
  const [scope, setScope] = useState<ForgeScope | null>(null);
  const [step, setStep] = useState<"entrega" | "giro" | "veredicto" | "hecho">("entrega");
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState<Bank>("cargando");
  const [giroRespuesta, setGiroRespuesta] = useState("");
  const [result, setResult] = useState<ForgeSubmitResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let b = await loadForgeBankItems(cellCode);
      if (!b) {
        const r = await ensureForgeBank(cellCode);
        if (r.ok) b = await loadForgeBankItems(cellCode);
      }
      if (!alive) return;
      if (!b) return setBank("sin-banco");
      const g = b.items.find((i) => i.type === "giro" && !b!.pendientes.includes(i.itemId));
      setBank({ giro: g ? { itemId: g.itemId, texto: g.statement } : null });
    })();
    return () => {
      alive = false;
    };
  }, [cellCode]);

  const total = useMemo(() => keys.reduce((n, k) => n + (text[k]?.length ?? 0), 0), [keys, text]);
  const filled = keys.every((k) => (text[k] ?? "").trim().length > 0);
  const tooLong = keys.some((k) => (text[k]?.length ?? 0) > MAX_SECTION) || total > MAX_TOTAL;
  const canSubmit = filled && !tooLong && apoyo !== null && scope !== null && !busy && bank !== "cargando";
  const nativa = cell?.alcance === "local+nativa";

  if (!cell || configError) {
    return (
      <section data-forge-flow="mision" data-cell={cellCode}>
        <p role="alert">{configError ?? "Este flujo no está bien configurado"}</p>
        <button type="button" onClick={onClose}>Cerrar</button>
      </section>
    );
  }

  async function entregar() {
    if (!canSubmit || !apoyo) return;
    const entrega = Object.fromEntries(ENTREGA_KEYS.map((k) => [k, keys.includes(k) ? (text[k] ?? "") : ARTEFACTO_TEXT])) as Record<EntregaKey, string>;
    const notes = ENTREGA_KEYS.map((k) => `## ${ENTREGA_LABELS[k]}\n\n${entrega[k]}`).join("\n\n");
    setBusy(true);
    setError(null);
    try {
      await fire("mission.submitted", { notes, entrega, apoyo } as unknown as Json, { goalId: FORGE_GOAL_ID, moduleId: cellId });
    } catch {
      setBusy(false);
      setError("No se pudo guardar la entrega en el log. No se avanzó.");
      return;
    }
    setBusy(false);
    setStep(typeof bank === "object" && bank.giro ? "giro" : "veredicto");
  }

  async function responderGiro() {
    if (typeof bank !== "object" || !bank.giro || !giroRespuesta.trim()) return;
    setBusy(true);
    try {
      await fire(
        "evidence.recorded",
        { itemId: bank.giro.itemId, type: "giro", phase: "respuesta", outcome: "registrado", source: "local", data: { respuesta: giroRespuesta } } as unknown as Json,
        { goalId: FORGE_GOAL_ID, moduleId: cellId },
      );
      setStep("veredicto");
    } catch {
      setError("No se pudo guardar la respuesta al giro.");
    } finally {
      setBusy(false);
    }
  }

  async function pedirVeredicto() {
    if (!kind || !scope) return;
    setBusy(true);
    const r = await submitForgeVerdict({
      cellCode,
      kind,
      scope,
      ...(attachments?.eventIds.length ? { artefactoEventIds: attachments.eventIds } : {}),
      ...(giroRespuesta.trim() ? { giroRespuesta } : {}),
    });
    setResult(r);
    setBusy(false);
    setStep("hecho");
  }

  return (
    <section data-forge-flow="mision" data-cell={cellCode} data-mode={mode} aria-label={`Entrega de ${cellCode}`}>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em]">↳ {cellCode} · {mode === "completo" ? "Entrega completa" : "Entrega del artefacto"}</p>
        <h2>{cell.title}</h2>
      </header>

      {step === "entrega" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void entregar();
          }}
        >
          {mode === "artefacto" && <p>El artefacto del flujo ya está en el log y es la evidencia. Los otros siete apartados dicen «{ARTEFACTO_TEXT}».</p>}
          {keys.map((k) => (
            <label key={k} style={{ display: "block" }}>
              <span>{ENTREGA_LABELS[k]}</span>
              <textarea
                aria-label={ENTREGA_LABELS[k]}
                value={text[k] ?? ""}
                maxLength={MAX_SECTION + 1}
                onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))}
              />
            </label>
          ))}
          <fieldset>
            <legend>¿Cómo lo hiciste?</legend>
            <label>
              <input type="radio" name="apoyo" value="independiente" checked={apoyo === "independiente"} onChange={() => setApoyo("independiente")} /> Independiente
            </label>
            <label>
              <input type="radio" name="apoyo" value="con_apoyo" checked={apoyo === "con_apoyo"} onChange={() => setApoyo("con_apoyo")} /> Con apoyo
            </label>
          </fieldset>
          <fieldset>
            <legend>Alcance de la evidencia</legend>
            <label>
              <input type="radio" name="alcance" value="local" checked={scope === "local"} onChange={() => setScope("local")} /> Local
            </label>
            {nativa && (
              <label>
                <input type="radio" name="alcance" value="nativa" checked={scope === "nativa"} onChange={() => setScope("nativa")} /> Instancia real (nativa)
              </label>
            )}
          </fieldset>
          {tooLong && <p role="alert">Máximo 8,000 caracteres por apartado y 40,000 en total.</p>}
          <button type="submit" disabled={!canSubmit}>Entregar</button>
        </form>
      )}

      {step === "giro" && typeof bank === "object" && bank.giro && (
        <div data-forge-giro="">
          <p className="font-mono text-xs uppercase tracking-[0.2em]">↘ Giro</p>
          <p>{bank.giro.texto}</p>
          <textarea aria-label="Respuesta al giro" value={giroRespuesta} onChange={(e) => setGiroRespuesta(e.target.value)} />
          <button type="button" disabled={!giroRespuesta.trim() || busy} onClick={() => void responderGiro()}>
            Responder al giro
          </button>
        </div>
      )}

      {step === "veredicto" && (
        <div>
          {bank === "sin-banco" ? (
            <p role="status">✕ {MOTIVO_SIN_BANCO}. Tu entrega quedó en el log; el veredicto se pide con el banco en el dispositivo.</p>
          ) : bank === "cargando" ? (
            <p role="status">Cargando el banco de la celda…</p>
          ) : (
            <button type="button" disabled={busy} onClick={() => void pedirVeredicto()}>
              Pedir veredicto
            </button>
          )}
        </div>
      )}

      {step === "hecho" && result && <p role="status">{resultText(result)}</p>}
      {error && <p role="alert">✕ {error}</p>}
      <button type="button" onClick={onClose}>Cerrar</button>
    </section>
  );
}
