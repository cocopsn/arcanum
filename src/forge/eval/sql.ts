import type { TestCase } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { SqlData } from "@/forge/bank/types/sql";

// k · sql evaluator (design §9.3 k, §16). The learner's query runs in Pyodide's sqlite3 through runPy (Worker,
// timeout). The `pass` of runPy (a deepEqual against `expected`) is NOT used: the harness returns both result sets
// and this module compares them in TypeScript — the whole multiset of rows (a sequence when `orden: si`), with the
// same number of columns and type normalization (integers, reals to 1e-9, text, NULL), in every fixture.
// The read-only lock is `PRAGMA query_only = ON`, set by the harness AFTER loading schema, data and fixture: a
// statement that starts with WITH can still end in DELETE, so the client filter below is only the first line.

/** §16: maximum length of a learner query (and of a `forense` control). */
export const SQL_QUERY_MAX = 5000;
/** §16 message when the query is not a single read statement. */
export const SQL_ONE_READ = "El ítem pide una sola consulta de lectura";

export type SqlCell = number | string | null;
export interface SqlTable {
  cols: string[];
  rows: SqlCell[][];
}

/** Python harness (constant; same file runs under CPython in scripts/forge/bank-check/sql.py). One call per fixture:
 *  a fresh :memory: database, schema + data + fixture with executescript, then query_only, then the reference and
 *  the learner query with execute (one statement; sqlite3 refuses two). */
export const SQL_HARNESS_PY = `
import sqlite3, math

def _cell(v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "x'" + bytes(v).hex() + "'"
    if isinstance(v, float) and not math.isfinite(v):
        return str(v)
    return v

def _query(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in (cur.description or [])]
    rows = [[_cell(v) for v in r] for r in cur.fetchall()]
    return {"cols": cols, "rows": rows}

def _err(e):
    return {"error": type(e).__name__ + ": " + str(e)}

def run_sql(esquema, datos, fixture, referencia, consulta):
    con = sqlite3.connect(":memory:")
    try:
        try:
            con.executescript(esquema)
            con.executescript(datos)
            if fixture:
                con.executescript(fixture)
            con.commit()
        except Exception as e:
            return {"setup": _err(e)}
        con.execute("PRAGMA query_only = ON")
        try:
            ref = _query(con, referencia)
        except Exception as e:
            ref = _err(e)
        try:
            alumno = _query(con, consulta)
        except Exception as e:
            alumno = _err(e)
        return {"ref": ref, "alumno": alumno}
    finally:
        con.close()
`;

export const SQL_HARNESS_FN = "run_sql";

// ── client filter (first line; query_only is the real lock) ─────────────────────────────────────────────────────

/** Blank out comments and the inside of strings and quoted identifiers, keeping every position (same length), so
 *  keyword and `;` checks never look inside a literal and a position in the skeleton is a position in the query. */
function codeSkeleton(sql: string): string {
  let out = "";
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < sql.length) {
    const c = sql[i]!;
    const n = sql[i + 1];
    if (c === "-" && n === "-") {
      const end = sql.indexOf("\n", i);
      const j = end < 0 ? sql.length : end;
      out += blank(sql.slice(i, j));
      i = j;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = sql.indexOf("*/", i + 2);
      const j = end < 0 ? sql.length : end + 2;
      out += blank(sql.slice(i, j));
      i = j;
      continue;
    }
    if (c === "'" || c === '"' || c === "`" || c === "[") {
      const close = c === "[" ? "]" : c;
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === close) {
          if (close !== "]" && sql[j + 1] === close) {
            j += 2; // doubled quote = escaped
            continue;
          }
          break;
        }
        j++;
      }
      const end = Math.min(j + 1, sql.length);
      out += c + blank(sql.slice(i + 1, end - 1)) + (end - 1 > i ? sql[end - 1]! : "");
      i = end;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** §16 filter: ≤ 5,000 characters; starts with SELECT or WITH; one statement (a trailing `;` is fine); no ATTACH
 *  and no PRAGMA. Returns the query to run (without the trailing `;`) or the message to show. */
export function screenSqlQuery(raw: string): { ok: true; sql: string } | { ok: false; error: string } {
  const q = (raw ?? "").trim();
  if (!q) return { ok: false, error: `${SQL_ONE_READ}: escribe una consulta.` };
  if (q.length > SQL_QUERY_MAX) return { ok: false, error: `${SQL_ONE_READ}: la consulta pasa de ${SQL_QUERY_MAX.toLocaleString("en-US")} caracteres.` };
  const sk = codeSkeleton(q);
  const first = sk.trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
  if (first !== "SELECT" && first !== "WITH") return { ok: false, error: `${SQL_ONE_READ}: debe empezar con SELECT o WITH.` };
  const semis = [...sk.matchAll(/;/g)].map((m) => m.index!);
  const lastCode = sk.trimEnd().length - 1;
  if (semis.some((p) => p !== lastCode)) return { ok: false, error: `${SQL_ONE_READ}: hay más de una sentencia.` };
  if (/\b(ATTACH|DETACH|PRAGMA)\b/i.test(sk)) return { ok: false, error: `${SQL_ONE_READ}: ATTACH y PRAGMA no están permitidos.` };
  const sql = semis.length ? q.slice(0, semis[0]).trimEnd() : q;
  return { ok: true, sql };
}

// ── comparison ───────────────────────────────────────────────────────────────────────────────────────────────────

/** One cell, normalized: integers as they are, reals rounded to 1e-9, text, NULL. Number vs text never match. */
function cellKey(v: unknown): string {
  if (v === null || v === undefined) return "N";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return `n:${v}`;
    const r = Math.round(v * 1e9) / 1e9;
    return `n:${Object.is(r, -0) ? 0 : r}`;
  }
  if (typeof v === "boolean") return `n:${v ? 1 : 0}`;
  return `s:${String(v)}`;
}
const rowKey = (row: unknown[]) => JSON.stringify(row.map(cellKey));

export type SqlCompare = { igual: true } | { igual: false; motivo: string };

/** Compare the learner's result with the reference's: same number of columns, then the whole set of rows (multiset;
 *  sequence when `ordered`). Never just the row count. */
export function compareSqlResults(ref: SqlTable, got: SqlTable, ordered: boolean): SqlCompare {
  if (ref.cols.length !== got.cols.length) {
    return { igual: false, motivo: `se esperaban ${ref.cols.length} columnas y tu consulta devuelve ${got.cols.length}` };
  }
  const a = ref.rows.map(rowKey);
  const b = got.rows.map(rowKey);
  if (a.length !== b.length) return { igual: false, motivo: `se esperaban ${a.length} filas y tu consulta devuelve ${b.length}` };
  if (ordered) {
    const i = a.findIndex((k, j) => k !== b[j]);
    return i < 0 ? { igual: true } : { igual: false, motivo: `la fila ${i + 1} no coincide (el ítem exige el orden)` };
  }
  const count = new Map<string, number>();
  for (const k of a) count.set(k, (count.get(k) ?? 0) + 1);
  let distintas = 0;
  for (const k of b) {
    const c = count.get(k) ?? 0;
    if (c > 0) count.set(k, c - 1);
    else distintas++;
  }
  return distintas === 0 ? { igual: true } : { igual: false, motivo: `${distintas} de ${b.length} filas no coinciden con el resultado esperado` };
}

// ── grading ──────────────────────────────────────────────────────────────────────────────────────────────────────

type RunOut = { setup?: { error: string }; ref?: SqlTable | { error: string }; alumno?: SqlTable | { error: string } };

const isTable = (x: unknown): x is SqlTable =>
  !!x && typeof x === "object" && Array.isArray((x as SqlTable).cols) && Array.isArray((x as SqlTable).rows) && (x as SqlTable).rows.every((r) => Array.isArray(r));
const errorOf = (x: unknown): string | null =>
  x && typeof x === "object" && typeof (x as { error?: unknown }).error === "string" ? (x as { error: string }).error : null;

export interface SqlFixtureResult {
  nombre: string;
  correcto: boolean;
  /** why it is incorrect (or the database error of the learner's query) */
  motivo?: string;
  /** the learner's result, to show it */
  alumno?: SqlTable;
}

export type SqlGrade =
  /** the client filter refused it: nothing ran */
  | { estado: "rechazada"; motivo: string }
  /** Python could not be loaded (first use without network) */
  | { estado: "sin-python" }
  | { estado: "tiempo" }
  /** the item's own data or reference failed: the bank's fault, never counted against the learner */
  | { estado: "error-item"; motivo: string }
  | { estado: "calificada"; correcto: boolean; fixtures: SqlFixtureResult[] };

/** The cases runPy receives: one per fixture, `[esquema, datos, fixture, referencia, consulta]`, expected unused. */
export function sqlCases(data: Pick<SqlData, "esquema" | "datos" | "fixtures">, referencia: string, consulta: string): TestCase[] {
  return data.fixtures.map((f) => ({ name: f.nombre, input: [data.esquema, data.datos, f.sql, referencia, consulta], expected: null }));
}

/** Run `consulta` against the reference in every fixture and grade it. `run` is runPy with sqlite3 (or a fake). */
export async function gradeSqlQuery(
  data: Pick<SqlData, "esquema" | "datos" | "fixtures" | "orden" | "solucion">,
  consulta: string,
  run: ExecRunner,
): Promise<SqlGrade> {
  const s = screenSqlQuery(consulta);
  if (!s.ok) return { estado: "rechazada", motivo: s.error };
  const ref = screenSqlQuery(data.solucion);
  if (!ref.ok) return { estado: "error-item", motivo: `la consulta de referencia no es una sola lectura (${ref.error})` };
  const res = await run(SQL_HARNESS_PY, SQL_HARNESS_FN, sqlCases(data, ref.sql, s.sql));
  if (res.pyUnavailable) return { estado: "sin-python" };
  if (res.timedOut) return { estado: "tiempo" };
  if (res.syntaxError) return { estado: "error-item", motivo: res.syntaxError };
  const fixtures: SqlFixtureResult[] = [];
  for (let i = 0; i < data.fixtures.length; i++) {
    const nombre = data.fixtures[i]!.nombre;
    const c = res.cases[i];
    if (!c || c.error) return { estado: "error-item", motivo: `fixture «${nombre}»: ${c?.error ?? "sin resultado"}` };
    const out = (c.output ?? {}) as RunOut;
    const setupErr = errorOf(out.setup);
    if (setupErr) return { estado: "error-item", motivo: `fixture «${nombre}»: los datos del ítem no cargan (${setupErr})` };
    const refErr = errorOf(out.ref);
    if (refErr || !isTable(out.ref)) return { estado: "error-item", motivo: `fixture «${nombre}»: la consulta de referencia falló (${refErr ?? "sin resultado"})` };
    const aErr = errorOf(out.alumno);
    if (aErr) {
      fixtures.push({ nombre, correcto: false, motivo: aErr });
      continue;
    }
    if (!isTable(out.alumno)) {
      fixtures.push({ nombre, correcto: false, motivo: "tu consulta no devolvió un resultado" });
      continue;
    }
    const cmp = compareSqlResults(out.ref, out.alumno, data.orden);
    fixtures.push(cmp.igual ? { nombre, correcto: true, alumno: out.alumno } : { nombre, correcto: false, motivo: cmp.motivo, alumno: out.alumno });
  }
  return { estado: "calificada", correcto: fixtures.length > 0 && fixtures.every((f) => f.correcto), fixtures };
}
