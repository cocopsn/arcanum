// Corredor de práctica del compañero (design §18.3-§18.5, protecciones c y h). Practica un LoteAceptado SIN tocar la
// maestría: no usa ExerciseMode (emite passLesson/resolveError), useActions, useReward ni audio. Cada intento escribe
// una fila en la tabla `intentos` de arcanum-companion (nunca en el log de eventos ni en arcanum-exercises). «Editar
// el lote» revalida completo y reemplaza el lote sólo si pasa. Centinela data-companion-chunk="cmp-practica-v1".
"use client";
import { useMemo, useState } from "react";
import { EditorPlano } from "./EditorPlano";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import { evaluateRun, formatValue, type ChoiceExercise, type CodeExercise, type Exercise, type ProductionExercise, type RunResult, type TestCase } from "@/lib/exercise";
import { validarLote, type LoteAceptado } from "@/lib/companion/lote";

export interface PracticaDeps {
  jsRun?: (code: string, fn: string, cases: TestCase[]) => Promise<RunResult & { pyUnavailable?: boolean }>;
  pyRun?: (code: string, fn: string, cases: TestCase[]) => Promise<RunResult & { pyUnavailable?: boolean }>;
  /** persiste un intento en arcanum-companion (NUNCA en el log) */
  guardarIntento?: (ejercicioId: string, resultado: "aprobado" | "fallo" | "autoevaluado") => void;
  /** revalida un lote editado (por omisión validarLote con los runners reales) */
  revalidar?: typeof validarLote;
}

export function Practica({ lote, alAprobar, deps = {} }: { lote: LoteAceptado; alAprobar: (ejercicioId: string) => void; deps?: PracticaDeps }) {
  const [actual, setActual] = useState<LoteAceptado>(lote);
  const [editando, setEditando] = useState(false);
  const [fuente, setFuente] = useState(lote.md);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const jsRun = deps.jsRun ?? ((c, f, cs) => runJs(c, f, cs, 3000));
  const pyRun = deps.pyRun ?? runPy;

  const alGuardarEdicion = async () => {
    const revalidar = deps.revalidar ?? validarLote;
    const r = await revalidar(fuente, { jsRun: deps.jsRun, pyRun: deps.pyRun });
    if (r.ok) {
      setActual(r);
      setEditando(false);
      setErrorEdicion(null);
    } else {
      setErrorEdicion(r.motivo);
    }
  };

  return (
    <div className="cmp-practica" data-companion-chunk="cmp-practica-v1">
      <div className="cmp-practica-barra">
        <span className="cmp-practica-marca">Generado por IA · práctica</span>
        <button type="button" className="cmp-boton cmp-practica-editar" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
          Editar el lote
        </button>
      </div>
      {editando ? (
        <div className="cmp-practica-edicion">
          <label htmlFor="cmp-lote-ta" className="cmp-sr">
            Fuente del lote
          </label>
          <textarea id="cmp-lote-ta" className="cmp-lote-ta" value={fuente} onChange={(e) => setFuente(e.target.value)} rows={10} spellCheck={false} />
          {errorEdicion && <p className="cmp-practica-error">{errorEdicion}</p>}
          <button type="button" className="cmp-boton" onClick={() => void alGuardarEdicion()}>
            Guardar y revalidar
          </button>
        </div>
      ) : (
        <ol className="cmp-practica-lista">
          {actual.practicables.map((ex) => (
            <li key={ex.id} className="cmp-practica-item">
              <ItemPractica ejercicio={ex} etiqueta={actual.etiquetas.get(ex.id) ?? ""} jsRun={jsRun} pyRun={pyRun} alAprobar={alAprobar} guardarIntento={deps.guardarIntento} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type Correr = (code: string, fn: string, cases: TestCase[]) => Promise<RunResult & { pyUnavailable?: boolean }>;

function ItemPractica({
  ejercicio,
  etiqueta,
  jsRun,
  pyRun,
  alAprobar,
  guardarIntento,
}: {
  ejercicio: Exercise;
  etiqueta: string;
  jsRun: Correr;
  pyRun: Correr;
  alAprobar: (id: string) => void;
  guardarIntento?: (id: string, r: "aprobado" | "fallo" | "autoevaluado") => void;
}) {
  if (ejercicio.kind === "code") return <ItemCode ejercicio={ejercicio} etiqueta={etiqueta} jsRun={jsRun} pyRun={pyRun} alAprobar={alAprobar} guardarIntento={guardarIntento} />;
  if (ejercicio.kind === "choice") return <ItemChoice ejercicio={ejercicio} etiqueta={etiqueta} alAprobar={alAprobar} guardarIntento={guardarIntento} />;
  if (ejercicio.kind === "production") return <ItemProduccion ejercicio={ejercicio} etiqueta={etiqueta} alAprobar={alAprobar} guardarIntento={guardarIntento} />;
  return null;
}

function ItemCode({
  ejercicio,
  etiqueta,
  jsRun,
  pyRun,
  alAprobar,
  guardarIntento,
}: {
  ejercicio: CodeExercise;
  etiqueta: string;
  jsRun: Correr;
  pyRun: Correr;
  alAprobar: (id: string) => void;
  guardarIntento?: (id: string, r: "aprobado" | "fallo" | "autoevaluado") => void;
}) {
  const [codigo, setCodigo] = useState(ejercicio.starter);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [aprobado, setAprobado] = useState(false);
  const [verRef, setVerRef] = useState(false);

  const ejecutar = async () => {
    const correr = ejercicio.lang === "python" ? pyRun : jsRun;
    const r = await correr(codigo, ejercicio.functionName, ejercicio.testCases);
    if (r.pyUnavailable) {
      setFeedback("No hay runtime de Python en este dispositivo.");
      return;
    }
    if (r.syntaxError) {
      setFeedback(r.syntaxError);
      guardarIntento?.(ejercicio.id, "fallo");
      return;
    }
    if (r.timedOut) {
      setFeedback("Tardó demasiado (posible lazo infinito).");
      guardarIntento?.(ejercicio.id, "fallo");
      return;
    }
    const ev = evaluateRun(r);
    if (ev.allPass) {
      setAprobado(true);
      setFeedback("¡Pasa todos los casos!");
      guardarIntento?.(ejercicio.id, "aprobado");
      alAprobar(ejercicio.id);
    } else if (ev.firstFail) {
      const f = ev.firstFail;
      setFeedback(`Falla: input=${formatValue(f.input.length === 1 ? f.input[0] : f.input)} esperado=${formatValue(f.expected)} obtenido=${f.error ?? formatValue(f.output)}`);
      guardarIntento?.(ejercicio.id, "fallo");
    }
  };

  return (
    <div className="cmp-item-code">
      <h4 className="cmp-item-titulo">{ejercicio.title}</h4>
      <p className="cmp-item-etiqueta">{etiqueta}</p>
      <p className="cmp-item-enunciado">{ejercicio.statement}</p>
      <EditorPlano valor={codigo} alCambiar={setCodigo} lang={ejercicio.lang} />
      <button type="button" className="cmp-boton" onClick={() => void ejecutar()}>
        Ejecutar
      </button>
      {feedback && <p className="cmp-item-feedback">{feedback}</p>}
      {(aprobado || verRef) && <pre className="cmp-item-ref">{ejercicio.referenceSolution}</pre>}
      {!aprobado && (
        <button type="button" className="cmp-boton cmp-ver-ref" onClick={() => setVerRef(true)}>
          Ver la referencia (generada por IA)
        </button>
      )}
    </div>
  );
}

function ItemChoice({
  ejercicio,
  etiqueta,
  alAprobar,
  guardarIntento,
}: {
  ejercicio: ChoiceExercise;
  etiqueta: string;
  alAprobar: (id: string) => void;
  guardarIntento?: (id: string, r: "aprobado" | "fallo" | "autoevaluado") => void;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const [comprobado, setComprobado] = useState(false);
  const comprobar = () => {
    if (elegida === null) return;
    setComprobado(true);
    const ok = elegida === ejercicio.answer;
    guardarIntento?.(ejercicio.id, ok ? "aprobado" : "fallo");
    if (ok) alAprobar(ejercicio.id);
  };
  return (
    <div className="cmp-item-choice">
      <h4 className="cmp-item-titulo">{ejercicio.title}</h4>
      <p className="cmp-item-etiqueta">{etiqueta}</p>
      <p className="cmp-item-enunciado">{ejercicio.statement}</p>
      <fieldset className="cmp-opciones">
        <legend className="cmp-sr">Opciones</legend>
        {ejercicio.options.map((op, i) => (
          <label key={i} className="cmp-opcion">
            <input type="radio" name={`op-${ejercicio.id}`} checked={elegida === i} onChange={() => setElegida(i)} />
            {op}
          </label>
        ))}
      </fieldset>
      <button type="button" className="cmp-boton" onClick={comprobar}>
        Comprobar
      </button>
      {comprobado && <p className="cmp-item-feedback">{elegida === ejercicio.answer ? "Correcto. " : "Incorrecto. "}{ejercicio.rationale}</p>}
    </div>
  );
}

function ItemProduccion({
  ejercicio,
  etiqueta,
  alAprobar,
  guardarIntento,
}: {
  ejercicio: ProductionExercise;
  etiqueta: string;
  alAprobar: (id: string) => void;
  guardarIntento?: (id: string, r: "aprobado" | "fallo" | "autoevaluado") => void;
}) {
  const [texto, setTexto] = useState("");
  const [verModelo, setVerModelo] = useState(false);
  const [marcadas, setMarcadas] = useState<boolean[]>(() => ejercicio.rubric.map(() => false));
  const todas = useMemo(() => marcadas.length > 0 && marcadas.every(Boolean), [marcadas]);
  const autoevaluar = () => {
    guardarIntento?.(ejercicio.id, "autoevaluado");
    if (todas) alAprobar(ejercicio.id);
  };
  return (
    <div className="cmp-item-produccion">
      <h4 className="cmp-item-titulo">{ejercicio.title}</h4>
      <p className="cmp-item-etiqueta">{etiqueta}</p>
      <p className="cmp-item-enunciado">{ejercicio.statement}</p>
      <label htmlFor={`prod-${ejercicio.id}`} className="cmp-sr">
        Tu producción
      </label>
      <textarea id={`prod-${ejercicio.id}`} className="cmp-prod-ta" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
      <button type="button" className="cmp-boton" onClick={() => setVerModelo(true)}>
        Ver modelo y regla
      </button>
      {verModelo && (
        <div className="cmp-prod-modelo">
          <p className="cmp-prod-regla">{ejercicio.rule}</p>
          <pre className="cmp-prod-respuesta">{ejercicio.modelAnswer}</pre>
          <ul className="cmp-prod-rubrica">
            {ejercicio.rubric.map((r, i) => (
              <li key={i}>
                <label className="cmp-rubrica-item">
                  <input
                    type="checkbox"
                    checked={marcadas[i] ?? false}
                    onChange={() => setMarcadas((m) => m.map((v, j) => (j === i ? !v : v)))}
                  />
                  {r}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="cmp-boton" onClick={autoevaluar}>
            Me autoevalúo
          </button>
        </div>
      )}
    </div>
  );
}
