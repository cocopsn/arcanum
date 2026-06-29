import { GRADES } from "@/core/grade";

// Authorable founder-narrative, one fragment per grade. Replace the text freely;
// the Códice renders fragments up to the current (record) grade automatically.
export const LORE_FRAGMENTS: readonly string[] = [
  "Empezaste sin nada salvo la negativa a apagarte. Esa fue la primera línea de la historia.",
  "El primer material que te resistió te enseñó que resistir es su manera de pedir forma.",
  "Un día la herramienta dejó de pelearte. Lo notaste tarde, a mitad de un trazo perfecto.",
  "No buscaste seguidores. Solo caminaste derecho el tiempo suficiente para que alguien notara la línea.",
  "Pusiste la primera piedra donde todos veían tierra. Nadie aplaudió. La piedra no lo necesitaba.",
  "Lo que levantaste empezó a sostenerse solo. Por primera vez descansaste sin que se cayera.",
  "Entraste a la sala donde se decide, y la silla del centro ya tenía tu nombre.",
  "Escuchaste a alguien explicar una idea como propia. Era tuya. Sonreíste y callaste.",
  "Dejaste de contar lo que hacías. Otros lo contaban por ti, y lo contaban más grande.",
  "Pasaron los años que borran a casi todos. Tu nombre seguía ahí, intacto, esperando.",
  "Ya no eres un punto en el mapa. Eres el punto desde el que se dibujan los demás.",
];

export interface CodexEntry {
  index: number;
  name: string;
  epithet: string;
  seal: string;
  color: string;
  text: string;
  /** a sealed roadmap node this grade reveals (Phase 3 wires the DAG render) */
  revealsNode: boolean;
}

/** Codex entries unlocked by the current (record) grade — derived from the log. */
export function codexUpTo(gradeIndex: number): CodexEntry[] {
  const out: CodexEntry[] = [];
  for (let i = 0; i <= gradeIndex && i < GRADES.length; i++) {
    const g = GRADES[i]!;
    out.push({
      index: i,
      name: g.name,
      epithet: g.epithet,
      seal: g.seal,
      color: g.color,
      text: LORE_FRAGMENTS[i] ?? "",
      revealsNode: i > 0, // every ascension beyond Scintilla unseals a node
    });
  }
  return out;
}
