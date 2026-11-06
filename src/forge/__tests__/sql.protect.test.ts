import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecRunner } from "@/lib/exercises-validate";
import { validateBank } from "@/lib/exercises-validate";
import { parseExercisesMd } from "@/lib/exercises-md";
import { compareSqlResults, gradeSqlQuery, screenSqlQuery, SQL_HARNESS_PY, type SqlTable } from "@/forge/eval/sql";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

// k · sql (design §9.3 k, §16). Protections, each with its red-check in bitacora-e2-datos.md:
//  1. the result is compared as the whole set of rows, never only the row count;
//  2. the learner's query cannot write: PRAGMA query_only = ON after loading schema, data and fixture (CPython runs
//     the same SQL_HARNESS_PY that Pyodide runs);
//  3. the client filter (first line) and the seed trust with the REAL module (no vi.mock): the seed never runs SQL,
//     an import without Python is rejected, and with a runner py.check runs once per item.

const T = (cols: string[], rows: (number | string | null)[][]): SqlTable => ({ cols, rows });

describe("sql · el resultado se compara como conjunto de filas", () => {
  it("misma cantidad de filas con valores distintos es incorrecta", () => {
    const ref = T(["cliente", "n"], [["a", 2], ["b", 1]]);
    const got = T(["cliente", "n"], [["a", 1], ["b", 1]]);
    expect(compareSqlResults(ref, got, false).igual, "se comparó el número de filas, no el conjunto").toBe(false);
  });
  it("el multiconjunto ignora el orden salvo con orden: si; normaliza reales a 1e-9 y distingue texto de número", () => {
    const ref = T(["x"], [[1], [2], [2]]);
    expect(compareSqlResults(ref, T(["x"], [[2], [1], [2]]), false).igual).toBe(true);
    expect(compareSqlResults(ref, T(["x"], [[2], [1], [2]]), true).igual).toBe(false);
    expect(compareSqlResults(ref, T(["x"], [[1], [1], [2]]), false).igual, "un multiconjunto con otra multiplicidad pasó").toBe(false);
    expect(compareSqlResults(T(["r"], [[0.1 + 0.2]]), T(["r"], [[0.3]]), false).igual).toBe(true);
    expect(compareSqlResults(T(["r"], [["1"]]), T(["r"], [[1]]), false).igual).toBe(false);
    expect(compareSqlResults(T(["a", "b"], [[1, 2]]), T(["a"], [[1]]), false).igual).toBe(false);
  });
  it("gradeSqlQuery califica con el conjunto en cada fixture, no con el pass de runPy", async () => {
    const d = { orden: false, esquema: "-", datos: "-", solucion: "SELECT 1", fixtures: [{ nombre: "base", sql: "-- fixture: base" }, { nombre: "dup", sql: "-- fixture: dup" }] };
    const run: ExecRunner = async (_c, _f, cases) => ({
      syntaxError: null,
      cases: cases.map((c, i) => ({
        input: c.input,
        expected: null,
        pass: true, // runPy's deepEqual: ignored on purpose
        output: { ref: T(["n"], [[i + 1]]), alumno: T(["n"], [[1]]) },
      })),
    });
    const g = await gradeSqlQuery(d, "SELECT n FROM t", run);
    expect(g.estado).toBe("calificada");
    if (g.estado !== "calificada") return;
    expect(g.fixtures.map((f) => f.correcto)).toEqual([true, false]);
    expect(g.correcto, "se comparó el número de filas, no el conjunto").toBe(false);
  });
});

describe("sql · filtro del cliente (§16)", () => {
  it("acepta una lectura con WITH, un ; final y ; dentro de cadenas o comentarios", () => {
    expect(screenSqlQuery("WITH a AS (SELECT 1) SELECT * FROM a;")).toEqual({ ok: true, sql: "WITH a AS (SELECT 1) SELECT * FROM a" });
    expect(screenSqlQuery("SELECT ';' AS s -- x; y").ok).toBe(true);
    expect(screenSqlQuery("-- comentario\nSELECT 1").ok).toBe(true);
  });
  it("rechaza lo que no es una sola consulta de lectura", () => {
    for (const q of ["INSERT INTO t VALUES (1)", "SELECT 1; SELECT 2", "SELECT 1; DELETE FROM t", "ATTACH DATABASE 'x' AS y", "SELECT 1 FROM pragma_table_info('t') WHERE 0; PRAGMA query_only = OFF", "SELECT * FROM t WHERE 1 = 1 -- \n; PRAGMA x", "", "SELECT " + "x".repeat(5000)]) {
      const r = screenSqlQuery(q);
      expect(r.ok, `el filtro dejó pasar: ${q.slice(0, 60)}`).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/^El ítem pide una sola consulta de lectura/);
    }
    expect(screenSqlQuery("SELECT 1 FROM t WHERE x = 'PRAGMA'").ok, "una palabra dentro de una cadena no es PRAGMA").toBe(true);
  });
});

// CPython runs the very same harness constant; Pyodide's sqlite3 is the same SQLite library.
function findPython(): { cmd: string; args: string[] } | null {
  for (const [cmd, ...args] of [["python3"], ["python"], ["py", "-3"]] as string[][]) {
    const r = spawnSync(cmd!, [...args, "-c", "import sqlite3;print(1)"], { encoding: "utf8", timeout: 20000 });
    if (r.status === 0 && r.stdout.trim() === "1") return { cmd: cmd!, args };
  }
  return null;
}
const PY = findPython();

function runHarness(args: string[]): { ref?: unknown; alumno?: unknown; setup?: unknown } {
  const dir = mkdtempSync(join(tmpdir(), "forge-sql-"));
  try {
    const file = join(dir, "h.py");
    writeFileSync(file, `${SQL_HARNESS_PY}\nimport json, sys\nprint(json.dumps(run_sql(*json.loads(sys.stdin.read()))))\n`, "utf8");
    const r = spawnSync(PY!.cmd, [...PY!.args, file], { input: JSON.stringify(args), encoding: "utf8", timeout: 20000 });
    if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
    return JSON.parse(r.stdout.trim().split(/\r?\n/).pop()!);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!PY)("sql · el arnés no deja escribir (PRAGMA query_only = ON)", () => {
  const ESQ = "CREATE TABLE t (id INTEGER, v TEXT);";
  const DAT = "INSERT INTO t VALUES (1, 'a'), (2, 'b');";
  it("una consulta WITH … DELETE que pasa el filtro falla en SQLite y no cambia la base", () => {
    const q = "WITH x AS (SELECT 1) DELETE FROM t";
    expect(screenSqlQuery(q).ok).toBe(true); // the client filter lets it through: query_only is the real lock
    const out = runHarness([ESQ, DAT, "-- fixture: base", "SELECT COUNT(*) FROM t", q]) as { alumno: { error?: string } };
    expect(out.alumno.error ?? "", "una consulta del alumno escribió en la base").toMatch(/readonly|read-only/i);
  });
  it("el esquema, los datos y el fixture cargan antes del candado y la lectura funciona", () => {
    const out = runHarness([ESQ, DAT, "-- fixture: mas\nINSERT INTO t VALUES (3, 'c');", "SELECT id, v FROM t", "SELECT v, id FROM t ORDER BY id DESC"]) as { ref: SqlTable; alumno: SqlTable };
    expect(out.ref.rows).toHaveLength(3);
    expect(compareSqlResults(out.ref, T(["id", "v"], [[3, "c"], [1, "a"], [2, "b"]]), false).igual).toBe(true);
    expect(out.alumno.rows[0]).toEqual(["c", 3]);
  });
  it("el arnés de bank-check (scripts/forge/bank-check/sql.py) contiene el mismo arnés, byte por byte", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "forge", "bank-check", "sql.py"), "utf8").replace(/\r\n/g, "\n");
    const block = src.split("# --- harness (igual a SQL_HARNESS_PY) ---\n")[1]?.split("# --- fin del arnés ---")[0];
    expect(block?.trim(), "el arnés de bank-check se separó del de la app").toBe(SQL_HARNESS_PY.trim());
  });
});

describe("sql · confianza de la semilla con el módulo real (§9.2)", () => {
  const bank = () => {
    const parsed = parseExercisesMd(bankMd([BLOCKS.sql]));
    if (!parsed) throw new Error("el bloque sql del fixture no parsea");
    return parsed;
  };
  it("sembrado: se acepta sin ejecutar SQL y el ítem no queda pendiente", async () => {
    const pyRun = vi.fn<ExecRunner>();
    const v = await validateBank(bank(), { source: "seed", pyRun });
    expect(v).toEqual({ ok: true, pendientes: [] });
    expect(pyRun, "un banco sembrado ejecutó SQL al ingerirse").not.toHaveBeenCalled();
  });
  it("importado sin Python: se rechaza con «no hay runtime para validar»", async () => {
    const v = await validateBank(bank(), { source: "import" });
    expect(v.ok, "un banco importado con SQL se aceptó sin validar la referencia").toBe(false);
    if (!v.ok) expect(v.errors.join(" ")).toMatch(/no hay runtime para validar/);
  });
  it("importado con runner: py.check corre una vez y exige que la ingenua difiera", async () => {
    const differs = vi.fn<ExecRunner>(async (_c, _f, cases) => ({
      syntaxError: null,
      cases: cases.map((c, i) => ({ input: c.input, expected: null, pass: false, output: { ref: T(["c", "n"], [["a", i + 1]]), alumno: T(["c", "n"], [["a", 1]]) } })),
    }));
    expect(await validateBank(bank(), { source: "import", pyRun: differs })).toEqual({ ok: true, pendientes: [] });
    expect(differs, "un banco importado con SQL se aceptó sin correr py.check").toHaveBeenCalledTimes(1);
    const same: ExecRunner = async (_c, _f, cases) => ({
      syntaxError: null,
      cases: cases.map((c) => ({ input: c.input, expected: null, pass: false, output: { ref: T(["c", "n"], [["a", 1]]), alumno: T(["c", "n"], [["a", 1]]) } })),
    });
    const v = await validateBank(bank(), { source: "import", pyRun: same });
    expect(v.ok, "una ingenua idéntica a la referencia pasó la ingesta").toBe(false);
  });
  it("check nunca ejecuta: rechaza una referencia que no es una sola lectura sin correr nada", async () => {
    const bad = BLOCKS.sql.replace("SELECT cliente, COUNT(*) FROM pedidos GROUP BY cliente;", "DELETE FROM pedidos;");
    const parsed = parseExercisesMd(bankMd([bad]));
    if (!parsed) throw new Error("el bloque sql modificado no parsea");
    const pyRun = vi.fn<ExecRunner>();
    const v = await validateBank(parsed, { source: "seed", pyRun });
    expect(v.ok).toBe(false);
    expect(pyRun).not.toHaveBeenCalled();
  });
});
