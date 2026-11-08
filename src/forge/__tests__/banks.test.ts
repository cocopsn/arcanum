import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { explainExercisesMd } from "@/lib/exercises-md";
import { validateBank } from "@/lib/exercises-validate";
import { CHECKS } from "@/forge/bank/check/registry";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { Exercise } from "@/lib/exercise";

// CONTENT TEST of the Forge banks (design §5.7, §9.2; CA-30/31 on real content, CA-77). Runs over whatever exists in
// content/forge/exercises/ — ZERO banks is green.
// - every bank parses (the reason is shown) and passes validateBank as the SEED does (no author code runs, M1);
// - route banks (F0-F2, S1-S2, P1-P5, SW1-SW4, A1-A2) follow the CA-77 content rule: ≥ 6 items, ≥ 1 with rol
//   prediccion or recuperacion, exactly 1 giro marked rol: transferencia, id: in all, ≤ 48 KiB. When only PENDING
//   items break it, it is reported as «CA-77 pendiente por <tipo>» and does not fail;
// - a verification/<código>.json whose sha10 matches the .md fails the test if it records a failed item;
// - FORGE_BANKS_STRICT=1 (integration, before the PR): a bank with executable author steps (code items, js/py steps of
//   the 16 types) needs a current bank-check run that covers them.

const ROOT = process.cwd();
const DIR = join(ROOT, "content", "forge", "exercises");
const VER = join(ROOT, "content", "forge", "verification");
const STRICT = process.env.FORGE_BANKS_STRICT === "1";
const ROUTE_CODE = /^(f[0-2]|s[1-2]|p[1-5]|sw[1-4]|a[1-2])-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BYTES = 48 * 1024;

const sha10 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".md")).sort() : [];

interface Verification {
  sha10?: string;
  items?: { id?: string; item?: string; resultado?: string }[];
}

/** The CA-77 content rule over a list of items. Returns the problems (empty = ok). */
export function routeBankRule(code: string, items: Exercise[], bytes: number): string[] {
  const out: string[] = [];
  if (bytes > MAX_BYTES) out.push(`${code}: el banco pasa de 48 KiB (${bytes} bytes)`);
  const blocks = new Map<string, Exercise>();
  for (const e of items) blocks.set(e.itemId ?? e.id, e); // a code block counts once (one per language in the runtime)
  const list = [...blocks.values()];
  if (list.length < 6) out.push(`${code}: el banco tiene ${list.length} ítems; necesita al menos 6`);
  if (!list.some((e) => e.rol === "prediccion" || e.rol === "recuperacion")) out.push(`${code}: ningún ítem tiene rol prediccion o recuperacion`);
  const giros = list.filter((e) => e.kind === "forge" && e.type === "giro");
  if (giros.length !== 1) out.push(`${code}: el banco tiene ${giros.length} giros; debe tener exactamente 1`);
  for (const g of giros) if (g.rol !== "transferencia") out.push(`el giro de ${code} no está marcado como transferencia`);

  for (const e of list) if (!e.itemId) out.push(`${code}: «${e.title}» no trae línea id:`);
  return out;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Content rule of retencion (design §5.5, rc60/rc39): every `variante_de` that is not `mision` is the id of
 *  another item of the same bank, and the retention's statement is not a copy of that item's. check/ sees one item;
 *  this sees the whole bank, so it lives here. */
export function retentionContentProblems(code: string, items: Exercise[]): string[] {
  const problems: string[] = [];
  const byItemId = new Map<string, Exercise>();
  for (const e of items) if (e.itemId) byItemId.set(e.itemId, e);
  for (const ret of items) {
    if (ret.kind !== "forge" || ret.type !== "retencion") continue;
    const varianteDe = ret.data.varianteDe;
    if (varianteDe === "mision") continue;
    const base = byItemId.get(varianteDe);
    if (!base) {
      problems.push(`${code}: la retención ${ret.itemId} apunta a variante_de «${varianteDe}», que no está en el banco`);
      continue;
    }
    if (norm(ret.statement) === norm(base.statement)) problems.push(`${code}: la retención ${ret.itemId} repite el enunciado de «${varianteDe}»`);
  }
  return problems;
}

async function executableItems(items: Exercise[]): Promise<string[]> {
  const out: string[] = [];
  for (const e of items) {
    if (e.kind === "code") out.push(e.itemId ?? e.id);
    if (e.kind !== "forge") continue;
    const mod = await CHECKS[e.type]();
    if (mod.js?.needs(e as ForgeBankItem) || mod.py?.needs(e as ForgeBankItem)) out.push(e.itemId);
  }
  return [...new Set(out)];
}

describe("banks · the CA-77 rule itself (fixtures)", () => {
  const item = (o: Partial<Exercise> & { kind: Exercise["kind"] }) => ({ id: "m:x", title: "t", statement: "s", moduleId: "m", source: "curated", ...o }) as Exercise;
  it("a giro without rol: transferencia fails with its own message", () => {
    const base = [1, 2, 3, 4, 5].map((n) => item({ kind: "choice", itemId: `c${n}`, rol: n === 1 ? "prediccion" : undefined } as Partial<Exercise> & { kind: "choice" }));
    const giro = item({ kind: "forge", type: "giro", itemId: "giro-x", rol: "practica" } as Partial<Exercise> & { kind: "forge" });
    expect(routeBankRule("p2-06", [...base, giro], 1000), "el giro de p2-06 no está marcado como transferencia y la regla CA-77 lo aceptó").toEqual([
      "el giro de p2-06 no está marcado como transferencia",
    ]);
    expect(routeBankRule("p2-06", [...base, { ...giro, rol: "transferencia" } as Exercise], 1000)).toEqual([]);
    expect(routeBankRule("p2-06", base, 1000).join(" ")).toMatch(/0 giros/);
  });
});

describe("banks · content/forge/exercises (zero banks is green)", () => {
  it(`there are ${files.length} Forge banks`, () => {
    expect(Array.isArray(files)).toBe(true);
  });

  it.each(files.map((f) => [f]))("%s", async (f) => {
    const code = f.replace(/\.md$/, "");
    const buf = readFileSync(join(DIR, f));
    expect(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, `${f} empieza con BOM`).toBe(false);
    const md = buf.toString("utf8");
    const r = explainExercisesMd(md);
    expect(r.ok, `${f} no cumple el contrato: ${r.ok ? "" : r.error}`).toBe(true);
    if (!r.ok) return;
    expect(UUID.test(r.bank.meta.moduleId ?? ""), `${f}: module_id debe ser el UUID de la celda`).toBe(true);

    const v = await validateBank(r.bank, { source: "seed", trustPython: true });
    expect(v.ok, `${f} no pasa la ingesta de la semilla: ${v.ok ? "" : v.errors.join(" | ")}`).toBe(true);
    const pendientes = new Set(v.ok ? v.pendientes : []);
    const offered = r.bank.exercises.filter((e) => !pendientes.has(e.id));
    if (pendientes.size) {
      const types = [...new Set(r.bank.exercises.filter((e) => pendientes.has(e.id)).map((e) => (e.kind === "forge" ? e.type : e.kind)))];
      console.info(`[banks.test] ${code}: ${pendientes.size} ítem(s) pendiente(s) por chequeo stub (${types.join(", ")})`);
    }

    if (ROUTE_CODE.test(code)) {
      const full = routeBankRule(code, r.bank.exercises, buf.length);
      expect(full, `${f}:\n- ${full.join("\n- ")}`).toEqual([]);
      const onOffered = routeBankRule(code, offered, buf.length);
      if (onOffered.length) {
        const types = [...new Set(r.bank.exercises.filter((e) => pendientes.has(e.id)).map((e) => (e.kind === "forge" ? e.type : e.kind)))];
        console.info(`[banks.test] CA-77 pendiente por ${types.join(", ")} en ${code}: ${onOffered.join("; ")}`);
      }
    }

    const vf = join(VER, `${code}.json`);
    const ver = existsSync(vf) ? (JSON.parse(readFileSync(vf, "utf8")) as Verification) : null;
    const current = ver !== null && ver.sha10 === sha10(buf);
    if (current) {
      const failed = (ver!.items ?? []).filter((i) => i.resultado === "fallo").map((i) => i.id ?? i.item ?? "?");
      expect(failed, `la referencia de ${code}/${failed[0]} falló en bank-check`).toEqual([]);
    }
    const exec = await executableItems(offered);
    if (exec.length && !current) {
      if (STRICT) expect.fail(`${code} tiene Python o SQL sin corrida vigente de bank-check (ítems ejecutables: ${exec.join(", ")})`);
      else console.info(`[banks.test] ${code}: ${exec.length} ítem(s) ejecutable(s) sin verificar (sin corrida vigente de bank-check)`);
    }

    const retProblems = retentionContentProblems(code, r.bank.exercises);
    expect(retProblems, retProblems.join(" | ")).toEqual([]);
  });
});

describe("banks · la regla de contenido de la retención (rc60, rc39)", () => {
  const RET = (statement: string, varianteDe: string, itemId: string): Exercise =>
    ({ id: `m:${itemId}`, itemId, kind: "forge", type: "retencion", title: itemId, statement, moduleId: "m", source: "curated", data: { dias: 7, varianteDe, forma: "defensa", rubrica: ["a", "b"] } }) as unknown as Exercise;
  const BASE = (statement: string, itemId: string): Exercise =>
    ({ id: `m:${itemId}`, itemId, kind: "forge", type: "giro", title: itemId, statement, moduleId: "m", source: "curated", data: {} }) as unknown as Exercise;

  it("un variante_de que no está en el banco es un problema", () => {
    expect(retentionContentProblems("p9-99", [RET("Defiende X.", "no-existe", "ret-x")]).join(" "), "la regla aceptó un variante_de que no está en el banco").toContain("que no está en el banco");
  });
  it("una retención que repite el enunciado de su base es un problema", () => {
    const items = [BASE("El mismo enunciado.", "base-x"), RET("El mismo enunciado.", "base-x", "ret-x")];
    expect(retentionContentProblems("p9-99", items).join(" "), "la regla aceptó una retención que repite el enunciado").toContain("repite el enunciado de");
  });
  it("una variante con otro enunciado y variante_de mision no es problema", () => {
    expect(retentionContentProblems("p9-99", [BASE("Enunciado base.", "base-x"), RET("Otra redacción distinta.", "base-x", "ret-x"), RET("Una misión.", "mision", "ret-y")])).toEqual([]);
  });
});
