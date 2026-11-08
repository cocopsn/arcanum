import type { RunResult } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { ForenseData } from "@/forge/bank/types/forense";
import { codeSkeleton, screenSqlQuery, type SqlCell } from "@/forge/eval/sql";

// m · forense evaluator (design §5.4, D3). The learner marks the step where each lie is born and writes one SQL
// control per lie; a control is correct when it returns rows on the lying pipeline and none on the corrected one
// (nor on the corrected one over clean data). Everything runs in one fixed Python harness over SQLite (Pyodide in
// the app, CPython in bank-check, same text): each database is :memory:, loaded with the author's schema, data and
// pipeline, and then locked read-only before any control runs. The full ingestion check (verify_forense) also lives
// in the harness, so the app at import time and bank-check run the same Python.
//
// The harness is declared with String.raw: it has backslashes ("\n".join, \s and \S in _PASO) that a plain template
// would turn into a real newline and a bare letter. It never contains a backtick, a dollar-brace, a backslash-u, a
// backslash-x or a backslash followed by a digit (§5.4.1).

export const FORENSE_HARNESS_PY = String.raw`
import sqlite3, math, re, json
from datetime import datetime, timedelta, timezone

_ID = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

def _q(name):
    # identificador validado y entre comillas dobles (rc80)
    if not isinstance(name, str) or not _ID.match(name): raise ValueError("identificador inválido: " + str(name))
    return '"' + name + '"'

def _nombre(name):
    # nombre de un objeto que creó el autor, entre comillas dobles
    return '"' + str(name).replace('"', '""') + '"'

_PASO = re.compile(r"^--\s*paso:\s*(\S+)\s*$")

def _pasos(sql):
    # [(id, sql)] por líneas «-- paso: <id>», como pasosOf; el SQL antes del primer paso queda con id None (rc100)
    out = []
    for line in sql.splitlines():
        m = _PASO.match(line.strip())
        if m: out.append((m.group(1), []))
        elif out: out[-1][1].append(line)
        elif line.strip() and not line.strip().startswith("--"): out.append((None, [line]))
    return [(i, "\n".join(ls)) for i, ls in out]

def _err(e):
    return type(e).__name__ + ": " + str(e)

def _cell(v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "x'" + bytes(v).hex() + "'"
    if isinstance(v, float) and not math.isfinite(v):
        return str(v)
    return v

def _load(esquema, datos, pipeline):
    # :memory:, executescript de los tres y commit; la última línea antes de devolver la conexión la deja de solo lectura
    con = sqlite3.connect(":memory:")
    try:
        con.executescript(esquema)
        con.executescript(datos)
        con.executescript(pipeline)
        con.commit()
    except Exception:
        con.close()
        raise
    con.execute("PRAGMA query_only = ON")
    return con

def _solo(pipeline, correccion, paso):
    # todo tomado de la corrección salvo «paso», que queda como en el que miente
    fix = dict(_pasos(correccion))
    return "\n".join("-- paso: " + i + "\n" + (s if i == paso else fix[i]) for i, s in _pasos(pipeline))

def _count(con, sql):
    # {"filas": n} | {"error": "Tipo: msg"}; una sola sentencia
    try:
        return {"filas": len(con.execute(sql).fetchall())}
    except Exception as e:
        return {"error": _err(e)}

def _ts(v):
    # ISO a fecha con zona; sin zona, UTC; una fecha sola es 00:00 UTC; None si no se entiende
    try:
        d = datetime.fromisoformat(str(v).strip().replace("Z", "+00:00"))
    except Exception:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)

def invariant_broken(con, inv, corte):
    t, sobre = inv["tipo"], _q(inv["sobre"]); cols = [_q(c) for c in inv.get("columnas", [])]
    tol = inv.get("tolerancia", 0)
    if t == "conteo":   return abs(con.execute("SELECT COUNT(*) FROM " + sobre).fetchone()[0] - inv["esperado"]) > tol
    if t == "suma":     return abs(con.execute("SELECT TOTAL(" + cols[0] + ") FROM " + sobre).fetchone()[0] - inv["esperado"]) > tol
    if t == "unicidad": return con.execute("SELECT 1 FROM " + sobre + " GROUP BY " + ", ".join(cols) + " HAVING COUNT(*) > 1 LIMIT 1").fetchone() is not None
    if t == "nulos":    return con.execute("SELECT COUNT(*) FROM " + sobre + " WHERE " + " OR ".join(c + " IS NULL" for c in cols)).fetchone()[0] > inv.get("esperado", 0)
    if t == "frescura":
        m = _ts(con.execute("SELECT MAX(" + cols[0] + ") FROM " + sobre).fetchone()[0])
        return m is None or m < _ts(corte) - timedelta(days=tol)
    raise ValueError("tipo de invariante desconocido: " + str(t))

def run_pasos(esquema, datos, pipeline):
    # por paso: los objetos nuevos de sqlite_master y el COUNT(*) de cada uno
    con = sqlite3.connect(":memory:")
    try:
        try:
            con.executescript(esquema)
            con.executescript(datos)
            con.commit()
        except Exception as e:
            return {"setup": _err(e)}
        vistos = set(r[0] for r in con.execute("SELECT name FROM sqlite_master").fetchall())
        pasos = []
        for i, s in _pasos(pipeline):
            try:
                con.executescript(s)
                objetos = []
                for r in con.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").fetchall():
                    if r[0] in vistos: continue
                    vistos.add(r[0])
                    objetos.append({"nombre": r[0], "filas": con.execute("SELECT COUNT(*) FROM " + _nombre(r[0])).fetchone()[0]})
                pasos.append({"id": i, "objetos": objetos})
            except Exception as e:
                pasos.append({"id": i, "error": _err(e)})
        return {"pasos": pasos}
    finally:
        con.close()

def run_control(esquema, datos, pipeline, control):
    # {"cols", "rows" (hasta 20), "filas"} | {"error"} | {"setup"}
    try:
        con = _load(esquema, datos, pipeline)
    except Exception as e:
        return {"setup": _err(e)}
    try:
        cur = con.execute(control)
        cols = [d[0] for d in (cur.description or [])]
        rows = [[_cell(v) for v in r] for r in cur.fetchall()]
        return {"cols": cols, "rows": rows[:20], "filas": len(rows)}
    except Exception as e:
        return {"error": _err(e)}
    finally:
        con.close()

def _fuentes(spec):
    # (nombre, datos, sql) de cada base: el que miente, el corregido y, con datos limpios, el corregido sobre ellos
    out = [("pipeline", spec["datos"], spec["pipeline"]), ("corregido", spec["datos"], spec["correccion"])]
    if spec.get("datos_limpios"): out.append(("corregido sobre datos limpios", spec["datos_limpios"], spec["correccion"]))
    return out

def _control(cons, sql):
    return {"miente": _count(cons[0], sql), "corregido": _count(cons[1], sql), "limpios": _count(cons[2], sql) if len(cons) > 2 else None}

def _distingue(o):
    def alarma(x): return "filas" in x and x["filas"] >= 1
    def silencio(x): return "filas" in x and x["filas"] == 0
    return alarma(o["miente"]) and silencio(o["corregido"]) and (o["limpios"] is None or silencio(o["limpios"]))

def grade_controles(spec, controles):
    # por control: {"miente", "corregido", "limpios" (None sin datos limpios)}
    try:
        cons = [_load(spec["esquema"], d, s) for _, d, s in _fuentes(spec)]
    except Exception as e:
        return {"setup": _err(e)}
    try:
        return {"controles": [_control(cons, c) for c in controles]}
    finally:
        for c in cons: c.close()

def verify_forense(spec):
    # {"problemas": [str]}: la ingesta completa, la misma al importar en la app y en bank-check
    problemas = []
    esquema, datos, pipeline, correccion, corte = spec["esquema"], spec["datos"], spec["pipeline"], spec["correccion"], spec["corte"]
    invs = dict((inv["id"], inv) for inv in spec["invariantes"])
    cons = []
    # 1. el pipeline y la corrección cargan (y la corrección sobre datos limpios, si los hay)
    for nombre, d, sql in _fuentes(spec):
        try:
            cons.append(_load(esquema, d, sql))
        except Exception as e:
            problemas.append("el " + nombre + " no carga: " + _err(e))
            return {"problemas": problemas}
    miente, corregidos = cons[0], cons[1:]
    # 2. la corrección tiene los mismos pasos que el pipeline, en el mismo orden
    if [i for i, _ in _pasos(correccion)] != [i for i, _ in _pasos(pipeline)]:
        problemas.append("la corrección no tiene los mismos pasos que el pipeline")
        return {"problemas": problemas}
    for m in spec["mentiras"]:
        inv = invs.get(m["invariante"])
        if inv is None:
            problemas.append("la mentira «" + m["id"] + "» rompe «" + str(m["invariante"]) + "», que no es un invariante")
            continue
        # 3. su invariante está roto en el pipeline que miente
        if not invariant_broken(miente, inv, corte):
            problemas.append("la mentira «" + m["id"] + "» no rompe su invariante en el pipeline")
        # 5. nace aquí: con los demás pasos de la corrección y sólo el suyo como en el que miente, sigue roto
        if not invariant_broken(_load(esquema, datos, _solo(pipeline, correccion, m["paso"])), inv, corte):
            problemas.append("la mentira «" + m["id"] + "» no nace en el paso «" + m["paso"] + "»")
    # 4. cada invariante se cumple en el corregido (y en el corregido sobre datos limpios)
    for inv in spec["invariantes"]:
        if any(invariant_broken(c, inv, corte) for c in corregidos):
            problemas.append("el invariante «" + inv["id"] + "» no se cumple en el corregido")
    # 6. cada control de referencia alarma sobre el que miente y calla sobre el corregido (y sobre datos limpios)
    for i, c in enumerate(spec["controles"]):
        if not _distingue(_control(cons, c)):
            problemas.append("el control de referencia " + str(i + 1) + " no distingue los dos pipelines")
    for c in cons: c.close()
    return {"problemas": problemas}
`;

export const FORENSE_FN = { pasos: "run_pasos", probar: "run_control", calificar: "grade_controles", verificar: "verify_forense" } as const;

export interface ForenseSpec {
  esquema: string;
  datos: string;
  pipeline: string;
  correccion: string;
  datos_limpios: string | null;
  invariantes: ForenseData["invariantes"];
  mentiras: ForenseData["mentiras"];
  controles: string[];
  corte: string;
}

export type ControlRun = { filas: number } | { error: string };
export interface ControlOutcome {
  miente: ControlRun;
  corregido: ControlRun;
  limpios: ControlRun | null;
}
export type ForenseGrade =
  | { estado: "rechazada"; motivo: string }
  | { estado: "sin-python" }
  | { estado: "tiempo" }
  | { estado: "error-item"; motivo: string }
  | { estado: "calificada"; correcto: boolean; porMentira: { pasoOk: boolean; control: ControlOutcome; controlOk: boolean; motivo?: string }[] };
export type ForensePaso = { id: string; objetos: { nombre: string; filas: number }[] } | { id: string; error: string };

export const FORENSE_CONTROL_DATOS = "El control debe medir los datos, no la definición del pipeline (no leas sqlite_master ni las funciones pragma_*).";
/** Simple SQLite identifier; check/forense.ts (sobre, columnas) and `_q` in the harness require it. */
export const FORENSE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const CATALOGO = /\bsqlite_(master|schema|temp_master|temp_schema)\b|\bpragma_\w+/i;   // literal (rc84)
const CATALOGO_CITADO = /["`\[]\s*(sqlite_(master|schema|temp_master|temp_schema)|pragma_\w+)\s*["`\]]/i;

/** screenSqlQuery and, on its result, the refusal of SQLite's catalog (fact 17). Used by gradeForense,
 *  probarControl and check/forense.ts (reference controls). */
export function screenForenseControl(raw: string): { ok: true; sql: string } | { ok: false; error: string } {
  const s = screenSqlQuery(raw);
  if (!s.ok) return s;
  const catalogo = CATALOGO.test(codeSkeleton(s.sql)) || CATALOGO_CITADO.test(s.sql);
  if (catalogo) return { ok: false, error: FORENSE_CONTROL_DATOS };
  return s;
}

/** ForenseData → the harness's `spec`, field by field; each reference control screened (its sql without the `;`). */
export function forenseSpec(d: ForenseData): ForenseSpec {
  const controles = d.controles.map((c) => {
    const s = screenForenseControl(c);
    return s.ok ? s.sql : c;
  });
  return {
    esquema: d.esquema,
    datos: d.datos,
    pipeline: d.pipeline.sql,
    correccion: d.correccion,
    datos_limpios: d.datosLimpios,
    invariantes: d.invariantes,
    mentiras: d.mentiras,
    controles,
    corte: d.corte,
  };
}

export function decideControl(o: ControlOutcome): { correcto: boolean; motivo?: "no-alarma" | "alarma-en-corregido" | "alarma-en-limpios" | "error" } {
  const alarma = (x: ControlRun) => "filas" in x && x.filas >= 1;
  const silencio = (x: ControlRun) => "filas" in x && x.filas === 0;
  const correcto = alarma(o.miente) && silencio(o.corregido) && (o.limpios === null || silencio(o.limpios));
  if (correcto) return { correcto: true };
  if ([o.miente, o.corregido, o.limpios].some((x) => x !== null && "error" in x)) return { correcto: false, motivo: "error" };
  if (!alarma(o.miente)) return { correcto: false, motivo: "no-alarma" };
  if (!silencio(o.corregido)) return { correcto: false, motivo: "alarma-en-corregido" };
  return { correcto: false, motivo: "alarma-en-limpios" };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

const toControlRun = (x: unknown): ControlRun =>
  isRecord(x) && typeof x.filas === "number" ? { filas: x.filas } : isRecord(x) && typeof x.error === "string" ? { error: x.error } : { error: "sin resultado" };

/** The failures that are not the harness's answer: no Python, timeout, harness that did not run or raised. */
function harnessFailure(res: RunResult & { pyUnavailable?: boolean }): Exclude<ForenseGrade, { estado: "calificada" | "rechazada" }> | null {
  if (res.pyUnavailable) return { estado: "sin-python" };
  if (res.timedOut) return { estado: "tiempo" };
  if (res.syntaxError) return { estado: "error-item", motivo: `el arnés forense no corrió (${res.syntaxError})` };
  const c = res.cases[0];
  if (!c || c.error !== undefined) return { estado: "error-item", motivo: `el arnés forense falló: ${c?.error ?? "sin resultado"}` };
  return null;
}

/** Row counts per step of the lying pipeline («Ver conteos por paso»). */
export async function runForensePasos(d: ForenseData, run: ExecRunner): Promise<ForensePaso[] | ForenseGrade> {
  const res = await run(FORENSE_HARNESS_PY, FORENSE_FN.pasos, [{ input: [d.esquema, d.datos, d.pipeline.sql], expected: null }]);
  const fail = harnessFailure(res);
  if (fail) return fail;
  const out = res.cases[0]!.output;
  if (isRecord(out) && typeof out.setup === "string") return { estado: "error-item", motivo: `los datos del ítem no cargan (${out.setup})` };
  if (!isRecord(out) || !Array.isArray(out.pasos)) return { estado: "error-item", motivo: "el arnés forense no devolvió los pasos" };
  return out.pasos as ForensePaso[];
}

/** One learner control on the lying pipeline only, to explore (shows up to 20 rows). */
export async function probarControl(d: ForenseData, sql: string, run: ExecRunner): Promise<{ cols: string[]; rows: SqlCell[][]; filas: number } | ForenseGrade> {
  const s = screenForenseControl(sql);
  if (!s.ok) return { estado: "rechazada", motivo: s.error };
  const res = await run(FORENSE_HARNESS_PY, FORENSE_FN.probar, [{ input: [d.esquema, d.datos, d.pipeline.sql, s.sql], expected: null }]);
  const fail = harnessFailure(res);
  if (fail) return fail;
  const out = res.cases[0]!.output;
  if (isRecord(out) && typeof out.setup === "string") return { estado: "error-item", motivo: `los datos del ítem no cargan (${out.setup})` };
  if (isRecord(out) && typeof out.error === "string") return { estado: "rechazada", motivo: out.error };
  if (!isRecord(out) || !Array.isArray(out.cols) || !Array.isArray(out.rows) || typeof out.filas !== "number") {
    return { estado: "error-item", motivo: "el arnés forense no devolvió un resultado" };
  }
  return { cols: out.cols as string[], rows: out.rows as SqlCell[][], filas: out.filas };
}

/** The submission: one step and one control per lie. Correct = every step right and every control distinguishes. */
export async function gradeForense(d: ForenseData, r: { pasos: string[]; controles: string[] }, run: ExecRunner): Promise<ForenseGrade> {
  const n = d.mentiras.length;
  if (r.pasos.length !== n || r.controles.length !== n) return { estado: "rechazada", motivo: `Marca un paso y escribe un control para cada una de las ${n} mentiras.` };
  const sqls: string[] = [];
  for (const c of r.controles) {
    const s = screenForenseControl(c);
    if (!s.ok) return { estado: "rechazada", motivo: s.error };
    sqls.push(s.sql);
  }
  const res = await run(FORENSE_HARNESS_PY, FORENSE_FN.calificar, [{ input: [forenseSpec(d), sqls], expected: null }]);
  const fail = harnessFailure(res);
  if (fail) return fail;
  const out = res.cases[0]!.output;
  if (isRecord(out) && typeof out.setup === "string") return { estado: "error-item", motivo: `el pipeline del ítem no carga (${out.setup})` };
  if (!isRecord(out) || !Array.isArray(out.controles) || out.controles.length !== n) return { estado: "error-item", motivo: "el arnés forense no devolvió un resultado por control" };
  const controles = out.controles as unknown[];
  const porMentira = d.mentiras.map((m, i) => {
    const o = isRecord(controles[i]) ? (controles[i] as Record<string, unknown>) : {};
    const control: ControlOutcome = { miente: toControlRun(o.miente), corregido: toControlRun(o.corregido), limpios: o.limpios == null ? null : toControlRun(o.limpios) };
    const dec = decideControl(control);
    return { pasoOk: r.pasos[i] === m.paso, control, controlOk: dec.correcto, ...(dec.motivo ? { motivo: dec.motivo } : {}) };
  });
  return { estado: "calificada", correcto: porMentira.every((p) => p.pasoOk && p.controlOk), porMentira };
}
