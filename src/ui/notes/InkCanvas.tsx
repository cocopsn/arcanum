"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ocrImage } from "@/sync/ai";
import { newEventId } from "@/core/event";
import type { InkDrawing, InkStroke, InkPoint } from "@/lib/note-ink";

// Plumita — the drawing pad. Captures hand strokes via Pointer Events (real pressure on Apple Pencil /
// stylus; 1 otherwise — honest). TWO outcomes, both first-class: SAVE the stroke as a drawing (it stays
// a drawing, embedded in the note), or CONVERT it to editable text via the SAME OCR Edge Function the
// notes already use (rasterize → gpt-4o vision → editable markdown). iOS-safe (touch-action:none,
// pointer capture). Honest when OCR isn't available (no session/AI).

const PALETTE = ["#0669F2", "#E6E0F4", "#f0a23c", "#4f9d7a", "#ff2e48"];

export function InkCanvas({
  onSave,
  onConvert,
  onClose,
}: {
  onSave: (ink: InkDrawing) => void;
  onConvert: (markdown: string) => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<InkStroke[]>([]);
  const currentRef = useRef<InkStroke | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [color, setColor] = useState(PALETTE[0]!);
  const [width, setWidth] = useState(2.5);
  const [hasInk, setHasInk] = useState(false);
  const [converted, setConverted] = useState(false);
  const [ocr, setOcr] = useState<{ status: "idle" | "working" | "error"; message?: string }>({ status: "idle" });

  // size the backing store to the element × DPR for crisp lines; redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: Math.round(rect.width), h: Math.round(rect.height) };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      redrawAll();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ctx2d() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function redrawAll() {
    const ctx = ctx2d();
    const { w, h } = sizeRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (const s of strokesRef.current) strokeOnce(ctx, s);
  }

  function strokeOnce(ctx: CanvasRenderingContext2D, s: InkStroke) {
    if (s.points.length === 0) return;
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    const [first, ...rest] = s.points;
    ctx.moveTo(first!.x, first!.y);
    let prev = first!;
    for (const p of rest) {
      ctx.lineWidth = s.size * (0.4 + 0.6 * p.p); // pressure modulates width
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      prev = p;
    }
    void prev;
  }

  function pointFrom(e: ReactPointerEvent): InkPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, p: pressure };
  }

  function onDown(e: ReactPointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    currentRef.current = { color, size: width, points: [pointFrom(e)] };
  }
  function onMove(e: ReactPointerEvent) {
    const cur = currentRef.current;
    const ctx = ctx2d();
    if (!cur || !ctx) return;
    const pt = pointFrom(e);
    const last = cur.points[cur.points.length - 1]!;
    cur.points.push(pt);
    ctx.strokeStyle = cur.color;
    ctx.lineWidth = cur.size * (0.4 + 0.6 * pt.p);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }
  function onUp() {
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur && cur.points.length > 0) {
      strokesRef.current.push(cur);
      setHasInk(true);
    }
  }

  function undo() {
    strokesRef.current.pop();
    setHasInk(strokesRef.current.length > 0);
    redrawAll();
  }
  function clear() {
    strokesRef.current = [];
    setHasInk(false);
    redrawAll();
  }

  function buildDrawing(): InkDrawing {
    const { w, h } = sizeRef.current;
    return { id: newEventId(), w, h, strokes: strokesRef.current.map((s) => ({ ...s, points: [...s.points] })) };
  }

  /** Rasterize the strokes to a white-bg PNG and OCR them via the existing Edge Function. */
  async function convert() {
    if (strokesRef.current.length === 0) return;
    setOcr({ status: "working" });
    try {
      const { w, h } = sizeRef.current;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of strokesRef.current) {
        // OCR reads dark ink on white best — render strokes in near-black regardless of pen colour
        strokeOnce(ctx, { ...s, color: "#111111", size: Math.max(2.5, s.size) });
      }
      const dataUrl = off.toDataURL("image/png");
      const { markdown } = await ocrImage(dataUrl);
      setOcr({ status: "idle" });
      setConverted(true);
      onConvert(markdown); // inserts text into the note WITHOUT closing → the stroke can still be saved ("las dos")
    } catch (e) {
      setOcr({ status: "error", message: e instanceof Error ? e.message : "El OCR falló." });
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-ink" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <button onClick={onClose} aria-label="Cerrar el lienzo" className="min-h-11 px-1 text-2xl leading-none text-text-faint hover:text-text">×</button>
        <span className="text-[11px] uppercase tracking-[0.2em] text-text-faint">Plumita</span>
        <button onClick={undo} disabled={!hasInk} className="min-h-11 px-2 text-[12px] uppercase tracking-wider text-text-muted disabled:opacity-30">Deshacer</button>
      </div>

      <div ref={wrapRef} className="relative mx-auto my-2 w-full max-w-md flex-1 overflow-hidden rounded-[var(--r-md)] border border-line" style={{ touchAction: "none", background: "var(--surface)" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={(e) => e.buttons && onUp()}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="font-serif text-[13px] italic text-text-faint">Dibuja con el dedo o el Pencil</span>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md px-4">
        <div className="flex items-center gap-2">
          {PALETTE.map((c) => (
            <button key={c} aria-label={`Color ${c}`} onClick={() => setColor(c)} className="h-7 w-7 rounded-full border-2 transition" style={{ background: c, borderColor: color === c ? "var(--text)" : "transparent" }} />
          ))}
          <input aria-label="Grosor" type="range" min={1} max={8} step={0.5} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="ml-1 flex-1 accent-[var(--action)]" />
          <button onClick={clear} disabled={!hasInk} className="min-h-11 px-2 text-[12px] uppercase tracking-wider text-text-faint disabled:opacity-30">Limpiar</button>
        </div>

        {ocr.status === "error" && <p className="mt-2 text-[12px] text-amber" role="status">{ocr.message}</p>}
        {converted && ocr.status === "idle" && (
          <p className="mt-2 text-[12px] text-topic" role="status" aria-live="polite">Texto insertado en la nota ✓ — guarda el trazo también, o cierra.</p>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              if (hasInk) onSave(buildDrawing());
              onClose();
            }}
            disabled={!hasInk}
            className="min-h-12 flex-1 rounded-[var(--r-sm)] border border-rank bg-rank-soft text-sm uppercase tracking-[0.16em] text-rank transition hover:brightness-125 disabled:opacity-40"
          >
            Guardar trazo
          </button>
          <button
            onClick={() => void convert()}
            disabled={!hasInk || ocr.status === "working"}
            aria-busy={ocr.status === "working"}
            className="min-h-12 flex-1 rounded-[var(--r-sm)] border border-line text-sm uppercase tracking-[0.16em] text-text-muted transition hover:border-topic hover:text-topic disabled:opacity-40"
          >
            {ocr.status === "working" ? "Leyendo…" : "Convertir a texto"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Static replay of a saved drawing as crisp SVG (resolution-independent, themeable). Read-only. */
export function InkReplay({ ink, onDelete }: { ink: InkDrawing; onDelete?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--r-sm)] border border-line bg-surface">
      <svg viewBox={`0 0 ${ink.w || 300} ${ink.h || 200}`} className="block h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Dibujo a mano">
        {ink.strokes.map((s, i) => (
          <polyline
            key={i}
            points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={s.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {onDelete && (
        <button onClick={onDelete} aria-label="Borrar dibujo" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full border border-line bg-surface-raised text-text-faint transition hover:text-amber">×</button>
      )}
    </div>
  );
}
