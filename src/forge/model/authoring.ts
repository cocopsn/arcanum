// ENGINEERING FORGE — authoring state of §19 of the master program (design §5.7, CA-22). A PURE function over the
// cell data and the published artifacts; it never reads a vitest result.
//   Especificado: the fiche is complete.
//   Autorado:     the artifacts of its class are present and valid (route: book + bank; SD: book + case;
//                 X and D: statement + deliverable).
//   Verificado:   the recorded bank-check run, with the sha10 of the CURRENT .md, has an APPROVED entry for EVERY
//                 executable item of the bank (or the rubric has a contrast record: none exist at launch).
// The executable items are counted FROM THE BANK — every item, of any type, with a JavaScript, Python or SQL step —
// never from the entries of the verification file: a step that bank-check did not record (no harness, a type it does
// not run) would otherwise vanish from the count and the cell would read «Verificado» without having run
// (orchestrator obligation, 2026-11-06). An executable item with no entry, a failed one or a «sin-verificar» one
// leaves the cell at «Autorado» at most.
// «Publicado» is declared by the deployment report, never computed here; «Calibrado» is never declared.
import type { ForgeCellData } from "@/forge/data/types";

export type AuthoringState = "especificado" | "autorado" | "verificado";

export const AUTHORING_LABELS: Readonly<Record<AuthoringState, string>> = {
  especificado: "Especificado",
  autorado: "Autorado",
  verificado: "Verificado",
};

/** The bank as parsed from content/forge/exercises/<code>.md. */
export interface ForgeBankForAuthoring {
  /** sha256[:10] of the current .md */
  sha10: string;
  /** the bank passed ingestion */
  valid: boolean;
  /** every item with the languages of ALL its code fences (any section) */
  items: readonly { id: string; langs: readonly string[] }[];
  /** §9.2 pending rule (D11.5): ids of items whose ingestion check is still a stub (`{ disponible: false }`).
   *  A bank with pending items passes ingestion but is never «Verificado». */
  pendientes?: readonly string[];
}

/** content/forge/verification/<code>.json (format frozen by c0-build, §5.7): only what this needs. */
export interface ForgeVerificationForAuthoring {
  /** sha256[:10] of the .md the run verified */
  sha10: string;
  items: readonly { id: string; resultado: string }[];
}

export interface ForgeArtifacts {
  /** a book of the code is published (book-index.json) */
  book: boolean;
  bank: ForgeBankForAuthoring | null;
  verification: ForgeVerificationForAuthoring | null;
  /** rubric contrast records (none at launch) */
  contrastRecords?: number;
}

const EXEC_LANG: Readonly<Record<string, "javascript" | "python" | "sql">> = {
  js: "javascript",
  javascript: "javascript",
  mjs: "javascript",
  py: "python",
  python: "python",
  python3: "python",
  sql: "sql",
  sqlite: "sql",
};

/** Ids of the bank items that have at least one JavaScript, Python or SQL step. */
export function executableItems(bank: ForgeBankForAuthoring): string[] {
  return bank.items.filter((it) => it.langs.some((l) => EXEC_LANG[l.trim().toLowerCase()] !== undefined)).map((it) => it.id);
}

/** Executable items WITHOUT an approved run: no entry, any entry that is not "paso", or a run of another .md. */
export function unverifiedItems(bank: ForgeBankForAuthoring, verification: ForgeVerificationForAuthoring | null): string[] {
  const exec = executableItems(bank);
  if (!verification || verification.sha10 !== bank.sha10) return exec;
  return exec.filter((id) => {
    const entries = verification.items.filter((e) => e.id === id);
    return entries.length === 0 || entries.some((e) => e.resultado !== "paso");
  });
}

type CellForAuthoring = Pick<ForgeCellData, "cls" | "ficha" | "d" | "x" | "sd">;

export function fichaComplete(cell: CellForAuthoring): boolean {
  const f = cell.ficha;
  if (!f || !f.mision?.trim() || !f.defensa?.trim()) return false;
  if (cell.cls === "ruta") return Array.isArray(f.fuentes) && f.fuentes.length > 0 && !!(f.foco?.trim() || f.resultado?.trim());
  return true;
}

function bankVerified(a: ForgeArtifacts): boolean {
  const b = a.bank;
  if (!b || !b.valid) return false;
  if ((b.pendientes?.length ?? 0) > 0) return false;
  return executableItems(b).length > 0 && unverifiedItems(b, a.verification).length === 0;
}

/** null when the fiche itself is incomplete (the extractor fails before that can ship). */
export function authoringState(cell: CellForAuthoring, a: ForgeArtifacts): AuthoringState | null {
  if (!fichaComplete(cell)) return null;
  const contrast = (a.contrastRecords ?? 0) > 0;
  switch (cell.cls) {
    case "ruta": {
      if (!(a.book && a.bank?.valid)) return "especificado";
      return bankVerified(a) || contrast ? "verificado" : "autorado";
    }
    case "expediente": {
      if (!(a.book && cell.sd && cell.sd.decision.trim() && cell.sd.entregable.trim())) return "especificado";
      return contrast ? "verificado" : "autorado";
    }
    case "reto": {
      if (!(cell.x && cell.x.reto.trim() && cell.x.entregable.trim())) return "especificado";
      return contrast ? "verificado" : "autorado";
    }
    case "diagnostico": {
      if (!(cell.d && cell.d.enunciado.trim())) return "especificado";
      return contrast ? "verificado" : "autorado";
    }
    default:
      return "especificado";
  }
}

/** Count of cells per state (the report gives the count per state, CA-22). */
export function authoringCounts(states: readonly (AuthoringState | null)[]): Record<AuthoringState | "incompleta", number> {
  const out = { especificado: 0, autorado: 0, verificado: 0, incompleta: 0 };
  for (const s of states) out[s ?? "incompleta"]++;
  return out;
}
