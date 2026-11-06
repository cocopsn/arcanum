import type { BankCheck, BankCheckModule, BankCheckPy } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { compareSqlResults, screenSqlQuery, sqlCases, SQL_HARNESS_FN, SQL_HARNESS_PY, type SqlTable } from "@/forge/eval/sql";

// Ingestion check of `sql` (design §9.3 k, §9.2, D8). `check` reads the block only (never executes): the parser
// already demands the fences and unique `-- fixture:` names; here the reference and the naive query must pass the
// same filter as the learner's query (one read statement), because they run the same way. `py.check` is the SQL step
// and runs ONLY when the bank is imported (Pyodide sqlite3, through the caller's runner): the reference runs in every
// fixture and the naive one differs in at least one. In the seed it never runs: bank-check.mjs verified it with
// CPython (scripts/forge/bank-check/sql.py) and recorded it in verification/<código>.json (§5.7).

const label = (item: ForgeBankItem) => `«${item.title}» (sql)`;

export const check: BankCheck = async (item) => {
  if (item.type !== "sql") return { ok: false, errors: [`${label(item)}: el chequeo de sql recibió un ítem ${item.type}`] };
  const errors: string[] = [];
  for (const [sec, q] of [["Solución", item.data.solucion], ["Ingenua", item.data.ingenua]] as const) {
    const s = screenSqlQuery(q);
    if (!s.ok) errors.push(`${label(item)}: ### ${sec}: ${s.error}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
};

const pyCheck: BankCheckPy = async (item, ctx) => {
  if (item.type !== "sql") return { ok: false, errors: [`${label(item)}: el chequeo de sql recibió un ítem ${item.type}`] };
  const d = item.data;
  const ref = screenSqlQuery(d.solucion);
  const naive = screenSqlQuery(d.ingenua);
  if (!ref.ok || !naive.ok) return { ok: false, errors: [`${label(item)}: la solución o la ingenua no son una sola consulta de lectura`] };
  const res = await ctx.pyRun(SQL_HARNESS_PY, SQL_HARNESS_FN, sqlCases(d, ref.sql, naive.sql));
  if (res.timedOut) return { ok: false, errors: [`${label(item)}: la verificación SQL agotó el tiempo`] };
  if (res.syntaxError) return { ok: false, errors: [`${label(item)}: el arnés SQL no corrió (${res.syntaxError})`] };
  const errors: string[] = [];
  let differs = false;
  d.fixtures.forEach((f, i) => {
    const out = (res.cases[i]?.output ?? null) as { setup?: { error: string }; ref?: SqlTable | { error: string }; alumno?: SqlTable | { error: string } } | null;
    if (!out || res.cases[i]?.error) {
      errors.push(`${label(item)}: fixture «${f.nombre}»: ${res.cases[i]?.error ?? "sin resultado"}`);
      return;
    }
    if (out.setup) {
      errors.push(`${label(item)}: fixture «${f.nombre}»: el esquema, los datos o el fixture no cargan (${out.setup.error})`);
      return;
    }
    if (!out.ref || "error" in out.ref) {
      errors.push(`${label(item)}: la solución de referencia falla en el fixture «${f.nombre}» (${out.ref && "error" in out.ref ? out.ref.error : "sin resultado"})`);
      return;
    }
    if (!out.alumno || "error" in out.alumno) {
      differs = true; // the naive query errors in this fixture: it differs
      return;
    }
    if (!compareSqlResults(out.ref, out.alumno, d.orden).igual) differs = true;
  });
  if (!errors.length && !differs) errors.push(`${label(item)}: la ingenua da el mismo resultado que la referencia en todos los fixtures`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const py: NonNullable<BankCheckModule["py"]> = {
  needs: (item) => item.type === "sql",
  check: pyCheck,
};
