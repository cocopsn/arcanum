import type { ReadModel } from "@/core/read-model";
import type { NodeNature, NodePart } from "@/core/event";
import { contentForModule } from "@/lib/subject-content";

// The adversarial EXIT GATE (WHITE ROOM). The user answers a justify-not-recognize
// question; the AI evaluator grades the justification against the cell's rubric
// (anchored to the canonical source) and DECIDES pass/fail — real power over
// progression. OFFLINE / no evaluator → the submission is ENQUEUED (ai.queued), never
// faked: the gate opens ONLY when the real evaluator judges it on reconnect. Pure.
//
// NATURE (structural, not a label): the cell's nature decides WHICH gate is fired. The rubric the
// evaluator receives is COMPOSED from the nature's stance + the cell's own rubric, so an 'a_mano'
// cell is interrogated as a design defence while a 'delegable' one is interrogated for auditable
// comprehension. This is the user's philosophy encoded: spend first-principle depth where it buys
// something unique, delegate the plumbing — and train the JUDGEMENT of which is which.

export interface NatureStance {
  label: string;
  /** what this nature means, shown in the cell detail */
  meaning: string;
  /** rubric lines PREPENDED to the cell's own rubric → they reshape the evaluator's stance */
  rubric: string[];
}

export const NATURE_STANCE: Record<NodeNature, NatureStance> = {
  a_mano: {
    label: "A mano",
    meaning: "Corazón intelectual: lo implementas desde cero y DEFIENDES cada decisión de diseño de primer principio.",
    rubric: [
      "GATE 'A MANO' — adversarial completo. Interroga las DECISIONES DE DISEÑO como un revisor hostil: ¿por qué ese umbral y no otro? ¿por qué ese enfoque y no la alternativa? ¿qué se rompe si cambia el supuesto?",
      "No basta que funcione: tiene que DEFENDERLO. Si sólo describe QUÉ hizo sin sostener POR QUÉ, no pasa.",
      "Rechaza la apelación a autoridad, al 'así se hace' o a la salida de un asistente: exige el razonamiento propio del aprendiz.",
    ],
  },
  delegable: {
    label: "Delegable",
    meaning: "Plomería: NO la escribes de raíz — demuestras que la entiendes lo suficiente para DIRIGIR y AUDITAR a un asistente.",
    rubric: [
      "GATE 'DELEGABLE' — comprensión, no implementación. Juzga si puede ESPECIFICAR la pieza, dirigir a un asistente de código y AUDITAR su salida.",
      "Exige que sepa qué puede salir mal y CÓMO verificarlo (criterio de aceptación concreto), no que recite la implementación desde cero.",
      "NO penalices delegar la escritura — eso es correcto aquí. Penaliza no poder detectar una salida incorrecta.",
    ],
  },
  mixto: {
    label: "Mixto",
    meaning: "Tiene partes a mano (defiendes) y partes delegables (diriges y auditas). El juicio de cuál es cuál es parte del reto.",
    rubric: [
      "GATE 'MIXTO' — la celda tiene sub-partes de distinta naturaleza. Exige DEFENSA de primer principio en las partes 'a mano' y COMPRENSIÓN auditable en las 'delegables'.",
      "Ubica cada afirmación en su parte: no exijas implementación desde cero en lo delegable, ni aceptes plomería superficial en lo que es a mano.",
    ],
  },
};

/** The nature's rubric, with the mixto sub-parts spelled out so the evaluator knows which is which. */
export function natureRubric(nature: NodeNature, parts: NodePart[]): string[] {
  const base = NATURE_STANCE[nature].rubric;
  if (nature !== "mixto" || parts.length === 0) return base;
  const map = parts.map((p) => `· «${p.name}» → ${p.nature === "a_mano" ? "A MANO (defiende el diseño)" : "DELEGABLE (dirige y audita)"}`);
  return [...base, "Sub-partes de esta celda:", ...map];
}

export interface GateContext {
  cellTitle: string;
  question: string;
  rubric: string[];
  /** the learner's justification (their answer) */
  justification: string;
  /** canonical source URLs the rubric is anchored to */
  sourceRefs: string[];
  /** the cell's NATURE — structural: it already reshaped `rubric` above, and is passed through so a
   *  future evaluator can branch on it directly. */
  nature: NodeNature;
}

/** Build the gate context from the log + the cell's authored gate. null if the cell
 *  has no gate (then there is nothing to evaluate). Pure. */
export function buildGateContext(rm: ReadModel, moduleId: string, justification: string): GateContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const content = contentForModule(moduleId);
  const gate = content?.gate;
  if (!gate) return null;
  const nature: NodeNature = m.nature ?? "a_mano";
  return {
    cellTitle: m.title,
    question: gate.question,
    // the NATURE's stance leads → it reshapes how the evaluator judges, then the cell's own rubric.
    rubric: [...natureRubric(nature, m.parts ?? []), ...gate.rubric],
    justification: justification.trim(),
    sourceRefs: content?.sourceUrls ?? [],
    nature,
  };
}
