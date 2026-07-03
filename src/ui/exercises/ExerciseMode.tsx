"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useActions } from "@/ui/use-actions";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { CodeEditor } from "@/ui/exercises/CodeEditor";
import { bankForModule } from "@/lib/exercise-bank";
import { PROCEDURAL_TEMPLATES, generateVariant } from "@/lib/procedural";
import { bookQuestionsForModule } from "@/lib/book-exercises";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import { evaluateRun, matchedPatterns, formatValue, type CodeExercise, type ChoiceExercise, type Exercise, type Lang, type RunResult } from "@/lib/exercise";
import { themeForGoal, worldVars } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";

// PHASE 2 — offline exercises. The learner writes the implementation from scratch; the code runs LOCALLY
// (JS Worker / Pyodide) and reports the REAL syntax error (Level 1) and the EXACT failing case (Level 2)
// — the evidence, never the solution. On pass: the honest fallback — if a SAVED idiomatic pattern matches,
// show it; if the heuristic has nothing, show the reference and advance ("offline verifica que corre y es
// correcto; la crítica de diseño la hace Asuka en la Fase 3"). No faked quality verdict, ever.

type Selected =
  | { type: "code"; ex: CodeExercise; template?: string }
  | { type: "choice"; ex: ChoiceExercise }
  | { type: "bookq"; text: string };

export function ExerciseMode({ moduleId, goalId, goalTitle, cellTitle, onClose }: { moduleId: string; goalId: string; goalTitle: string; cellTitle: string; onClose: () => void }) {
  const theme = themeForGoal(goalTitle);
  const accent = theme.accent;
  const ink = readableAccent(accent);
  const { passLesson, resolveError } = useActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const [curated, setCurated] = useState<Exercise[]>([]);
  const [bookQs, setBookQs] = useState<string[]>([]);
  const [procLang, setProcLang] = useState<Lang>("js");
  const [sel, setSel] = useState<Selected | null>(null);

  useFocusTrap(rootRef);
  useEffect(() => {
    audio.unlock();
    setCurated(bankForModule(moduleId));
    void bookQuestionsForModule(moduleId).then(setBookQs);
  }, [moduleId]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Ejercicios · ${cellTitle}`}
      tabIndex={-1}
      className="fixed inset-0 z-[78] flex flex-col outline-none"
      style={{ ...worldVars(theme), background: `linear-gradient(172deg, ${theme.bg2}, ${theme.bg})`, paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === "Escape") (sel ? setSel(null) : onClose());
      }}
    >
      <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4">
        <button onClick={() => (sel ? setSel(null) : onClose())} aria-label="Volver" className="-ml-1 min-h-11 px-1 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        <span className="font-display text-sm tracking-[0.24em]" style={{ color: ink }}>EJERCICIOS · FASE 2</span>
      </header>

      <main className="scroll-touch mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-16 pt-3">
        {!sel ? (
          <Picker
            curated={curated}
            bookQs={bookQs}
            procLang={procLang}
            setProcLang={setProcLang}
            accent={accent}
            onPick={setSel}
          />
        ) : sel.type === "code" ? (
          <CodeRunner
            key={sel.ex.id + (sel.template ?? "")}
            ex={sel.ex}
            accent={accent}
            onPassed={(hadFailure) => {
              void passLesson({ goalId, moduleId }, 1);
              if (hadFailure) void resolveError({ goalId, moduleId }, `Ejercicio «${sel.ex.title}»: fallé un test y lo corregí.`);
            }}
            onNextVariant={sel.template ? () => spawnVariant(sel.template!, sel.ex.lang, setSel) : undefined}
          />
        ) : sel.type === "choice" ? (
          <ChoiceRunner ex={sel.ex} accent={accent} onCorrect={() => void passLesson({ goalId, moduleId }, 1)} />
        ) : (
          <BookQuestion text={sel.text} accent={accent} />
        )}
      </main>
    </div>
  );
}

function spawnVariant(templateId: string, lang: Lang, setSel: (s: Selected) => void) {
  const ex = generateVariant(templateId, lang, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  if (ex) setSel({ type: "code", ex, template: templateId });
}

function Picker({ curated, bookQs, procLang, setProcLang, accent, onPick }: { curated: Exercise[]; bookQs: string[]; procLang: Lang; setProcLang: (l: Lang) => void; accent: string; onPick: (s: Selected) => void }) {
  const ink = readableAccent(accent);
  const codeEx = curated.filter((e): e is CodeExercise => e.kind === "code");
  const choiceEx = curated.filter((e): e is ChoiceExercise => e.kind === "choice");
  const card = "w-full rounded-[var(--r-md)] border border-line bg-surface p-3 text-left transition hover:border-rank";
  return (
    <div className="space-y-6">
      <p className="text-[12px] leading-snug text-text-muted">Escribe la implementación desde cero. Se ejecuta AQUÍ, sin datos, y te muestra el error real o el caso exacto que falla — no la solución. Fallar es el punto.</p>

      {codeEx.length > 0 && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-faint">Banco curado · escribir código</div>
          <div className="mt-2 space-y-2">
            {codeEx.map((e) => (
              <button key={e.id} onClick={() => onPick({ type: "code", ex: e })} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-[14px] text-text">{e.title}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider" style={{ color: ink }}>{e.lang === "python" ? "Python" : "JS"}</span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-text-faint">{e.statement}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-faint">Práctica infinita · variantes</div>
          <div className="flex gap-1">
            {(["js", "python"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setProcLang(l)} aria-pressed={procLang === l} className="min-h-8 rounded-[var(--r-sm)] px-2 text-[11px] uppercase tracking-wider transition" style={{ color: procLang === l ? ink : "var(--text-faint)", background: procLang === l ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent" }}>
                {l === "python" ? "Python" : "JS"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-text-faint">Datos aleatorios cada intento → repaso de sintaxis sin fin (variantes de patrones, no problemas nuevos).</p>
        <div className="mt-2 space-y-2">
          {PROCEDURAL_TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => spawnVariant(t.id, procLang, onPick)} className={card}>
              <span className="font-serif text-[14px] text-text">{t.label}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-text-faint">generar variante ›</span>
            </button>
          ))}
        </div>
      </section>

      {choiceEx.length > 0 && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-faint">Conceptuales · opción + justificación</div>
          <div className="mt-2 space-y-2">
            {choiceEx.map((e) => (
              <button key={e.id} onClick={() => onPick({ type: "choice", ex: e })} className={card}>
                <span className="font-serif text-[14px] text-text">{e.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {bookQs.length > 0 && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-faint">Del libro · preguntas que deberías poder responder</div>
          <div className="mt-2 space-y-2">
            {bookQs.map((q, i) => (
              <button key={i} onClick={() => onPick({ type: "bookq", text: q })} className={card}>
                <span className="font-serif text-[13px] leading-snug text-text-muted">{q}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {codeEx.length === 0 && choiceEx.length === 0 && bookQs.length === 0 && (
        <p className="text-[13px] text-text-faint">Esta celda aún no tiene ejercicios curados. Usa la práctica infinita de arriba (JS/Python) para machacar sintaxis.</p>
      )}
    </div>
  );
}

function CodeRunner({ ex, accent, onPassed, onNextVariant }: { ex: CodeExercise; accent: string; onPassed: (hadFailure: boolean) => void; onNextVariant?: () => void }) {
  const ink = readableAccent(accent);
  const [code, setCode] = useState(ex.starter);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<(RunResult & { pyUnavailable?: boolean }) | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [passed, setPassed] = useState(false);
  const hadFailure = useRef(false);
  const firedPass = useRef(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    const r = ex.lang === "python" ? await runPy(code, ex.functionName, ex.testCases) : await runJs(code, ex.functionName, ex.testCases);
    setResult(r);
    setRunning(false);
    const ev = evaluateRun(r);
    // The on-screen verdict tracks the CURRENT run: a pass later edited into a failing run must STOP showing
    // "correcto" (no stale placebo verdict). The checkpoint/XP is one-shot (firedPass) → a genuinely-earned
    // pass is never un-awarded nor re-fired, but the panel reflects the truth of the last execution.
    setPassed(ev.allPass);
    if (ev.allPass) {
      audio.sfx("lessonwin");
      if (!firedPass.current) {
        firedPass.current = true;
        onPassed(hadFailure.current);
      }
    } else if ((r as { pyUnavailable?: boolean }).pyUnavailable) {
      audio.sfx("error");
    } else if (r.syntaxError || r.timedOut) {
      audio.sfx("error");
    } else {
      audio.sfx("heart");
      hadFailure.current = true;
    }
  }

  const firstFail = result ? evaluateRun(result).firstFail : null;
  const patterns = passed ? matchedPatterns(code, ex.patterns) : [];

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-text-faint">{ex.lang === "python" ? "Python" : "JavaScript"} · {ex.source === "procedural" ? "variante" : "banco"}</div>
      <h2 className="font-display text-xl leading-tight" style={{ color: ink }}>{ex.title}</h2>
      <p className="font-serif text-[14px] leading-snug text-text">{ex.statement}</p>
      {ex.pseudocode && (
        <div className="rounded-[var(--r-sm)] border-l-2 p-3" style={{ borderColor: accent, background: "color-mix(in srgb, var(--world-fog) 40%, transparent)" }}>
          <div className="text-[9px] uppercase tracking-[0.2em] text-text-faint">Spec (el qué, no el cómo)</div>
          <p className="mt-1 font-mono text-[12px] leading-snug text-text-muted">{ex.pseudocode}</p>
        </div>
      )}

      <CodeEditor value={code} onChange={setCode} lang={ex.lang} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void run()} disabled={running} aria-busy={running} className="min-h-11 flex-1 rounded-[var(--r-sm)] border font-display text-sm uppercase tracking-[0.16em] transition hover:brightness-125 disabled:opacity-40" style={{ borderColor: accent, color: ink, background: `color-mix(in srgb, ${accent} 10%, transparent)` }}>
          {running ? (ex.lang === "python" ? "Cargando Python / ejecutando…" : "Ejecutando…") : "Ejecutar"}
        </button>
        {ex.hints.length > 0 && hintLevel < ex.hints.length && !passed && (
          <button onClick={() => setHintLevel((n) => n + 1)} className="min-h-11 rounded-[var(--r-sm)] border border-line px-3 text-[12px] uppercase tracking-wider text-text-muted transition hover:text-text">Pista</button>
        )}
      </div>

      {hintLevel > 0 && !passed && (
        <ul className="space-y-1">
          {ex.hints.slice(0, hintLevel).map((h, i) => (
            <li key={i} className="rounded-[var(--r-sm)] border border-line bg-surface p-2 text-[12px] text-text-muted">💡 {h}</li>
          ))}
        </ul>
      )}

      {/* results — Level 1 (syntax) / Level 2 (exact failing case), honest */}
      <div role="status" aria-live="polite">
        {result?.pyUnavailable ? (
          <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>Runtime de Python no disponible</div>
            <p className="mt-1 text-[13px] leading-snug text-text-muted">Python corre con CPython descargado UNA vez. Conéctate una vez para bajarlo; después funciona sin datos. (JS corre offline ya.)</p>
          </div>
        ) : result?.timedOut ? (
          <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>Tiempo agotado</div>
            <p className="mt-1 text-[13px] text-text-muted">Tu código tardó demasiado — probablemente un lazo infinito. Se detuvo sin colgar la app. Revisa la condición de corte.</p>
          </div>
        ) : result?.syntaxError ? (
          <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>No compila (Nivel 1)</div>
            <pre className="scroll-touch mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[12px] text-text">{result.syntaxError}</pre>
          </div>
        ) : passed ? (
          <PassPanel ex={ex} accent={accent} patterns={patterns} onNextVariant={onNextVariant} />
        ) : firstFail ? (
          <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>Falla un caso (Nivel 2) · la evidencia, no la solución</div>
            <div className="mt-2 space-y-1 font-mono text-[12px]">
              <div className="text-text-muted">entrada: <span className="text-text">{formatValue(firstFail.input.length === 1 ? firstFail.input[0] : firstFail.input)}</span></div>
              {firstFail.error ? (
                <div className="text-text-muted">error: <span style={{ color: "var(--amber)" }}>{firstFail.error}</span></div>
              ) : (
                <div className="text-text-muted">tu salida: <span style={{ color: "var(--amber)" }}>{formatValue(firstFail.output)}</span></div>
              )}
              <div className="text-text-muted">esperado: <span style={{ color: readableAccent(accent) }}>{formatValue(firstFail.expected)}</span></div>
            </div>
            <p className="mt-2 text-[12px] text-text-faint">Caza el bug: {result?.cases.filter((c) => c.pass).length}/{result?.cases.length} casos pasan.</p>
          </div>
        ) : null}
      </div>

      {/* the final, explicit reference (only on demand — never up front) */}
      {!passed && hintLevel >= ex.hints.length && (
        <div>
          <button onClick={() => setShowSolution((v) => !v)} className="min-h-11 text-[12px] uppercase tracking-wider text-text-faint transition hover:text-text-muted">{showSolution ? "Ocultar" : "Ver solución de referencia"}</button>
          {showSolution && <pre className="scroll-touch mt-1 overflow-x-auto rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[12px] text-text">{ex.referenceSolution}</pre>}
        </div>
      )}
    </div>
  );
}

function PassPanel({ ex, accent, patterns, onNextVariant }: { ex: CodeExercise; accent: string; patterns: string[]; onNextVariant?: () => void }) {
  const ink = readableAccent(accent);
  const [showRef, setShowRef] = useState(patterns.length === 0);
  return (
    <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: accent }}>
      <div className="font-display text-sm uppercase tracking-[0.16em]" style={{ color: ink }}>Corre y es correcto ✓ +{50} XP</div>
      {patterns.length > 0 ? (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Sugerencia idiomática (patrón guardado)</div>
          <ul className="mt-1 space-y-1">
            {patterns.map((p, i) => (
              <li key={i} className="text-[13px] leading-snug text-text-muted">· {p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-1 text-[13px] leading-snug text-text-muted">Offline verifico que CORRE y es CORRECTO. La crítica de diseño (elegancia) la hace Asuka en la Fase 3, con IA — este ejercicio queda <span style={{ color: ink }}>revisable con IA</span>. Aquí está la referencia para comparar:</p>
      )}
      <button onClick={() => setShowRef((v) => !v)} className="mt-2 min-h-11 text-[12px] uppercase tracking-wider text-text-faint transition hover:text-text-muted">{showRef ? "Ocultar" : "Ver"} solución de referencia</button>
      {showRef && <pre className="scroll-touch mt-1 overflow-x-auto rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[12px] text-text">{ex.referenceSolution}</pre>}
      {onNextVariant && (
        <button onClick={onNextVariant} className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125" style={{ borderColor: accent, color: ink }}>Otra variante ›</button>
      )}
    </div>
  );
}

function ChoiceRunner({ ex, accent, onCorrect }: { ex: ChoiceExercise; accent: string; onCorrect: () => void }) {
  const ink = readableAccent(accent);
  const [picked, setPicked] = useState<number | null>(null);
  const fired = useRef(false);
  const answered = picked !== null;
  const correct = picked === ex.answer;
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl leading-tight" style={{ color: ink }}>{ex.title}</h2>
      <p className="font-serif text-[14px] leading-snug text-text">{ex.statement}</p>
      <div className="space-y-2">
        {ex.options.map((o, i) => {
          const isPicked = picked === i;
          const reveal = answered && (i === ex.answer || isPicked);
          const good = i === ex.answer;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => {
                setPicked(i);
                if (i === ex.answer) {
                  audio.sfx("lessonwin");
                  if (!fired.current) {
                    fired.current = true;
                    onCorrect();
                  }
                } else audio.sfx("heart");
              }}
              className="block w-full rounded-[var(--r-sm)] border p-3 text-left text-[13px] transition disabled:cursor-default"
              style={{ borderColor: reveal ? (good ? accent : "var(--amber)") : "var(--line)", color: "var(--text)", background: reveal && good ? `color-mix(in srgb, ${accent} 10%, transparent)` : "transparent" }}
            >
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: correct ? accent : "var(--amber)" }}>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: correct ? ink : "var(--amber)" }}>{correct ? "Correcto" : "No es esa"}</div>
          <p className="mt-1 text-[13px] leading-snug text-text-muted">{ex.rationale}</p>
        </div>
      )}
    </div>
  );
}

function BookQuestion({ text, accent }: { text: string; accent: string }) {
  const ink = readableAccent(accent);
  const [answer, setAnswer] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-text-faint">Pregunta del libro · autoevaluación</div>
      <p className="font-serif text-[16px] leading-snug text-text">{text}</p>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="Respóndela de memoria — es para ti…" className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-serif text-[14px] text-text placeholder:text-text-faint focus:outline-none" style={{ borderColor: `color-mix(in srgb, ${accent} 30%, var(--line))` }} />
      <p className="text-[12px] leading-snug text-text-faint">Offline no se autocalifica una respuesta abierta (sería un placebo). Es reflexión: queda <span style={{ color: ink }}>revisable con Asuka (Fase 3)</span>, con IA, cuando haya red.</p>
    </div>
  );
}
