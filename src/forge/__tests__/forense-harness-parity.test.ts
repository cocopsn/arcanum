import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORENSE_HARNESS_PY } from "@/forge/eval/forensics";

// m · forense (design §5.4, §5.4.1, D3). The app's harness (FORENSE_HARNESS_PY, declared with String.raw) and
// scripts/forge/bank-check/forense.py share the harness block byte for byte, so Pyodide (app) and CPython
// (bank-check) run the same Python. The backslash assertion goes FIRST (rc94): a plain template would turn `\n`
// and `\s` into a newline and a bare letter in silence, and the parity test alone would not say why it broke.

describe("forense · el arnés llega a Python con el texto que se escribió", () => {
  it("FORENSE_HARNESS_PY conserva sus barras invertidas (String.raw, no plantilla sin etiqueta)", () => {
    // `"\n".join` in _solo/_pasos and \s / \S in _PASO: a plain template would collapse them.
    expect(FORENSE_HARNESS_PY.includes(String.raw`"\n".join`), "FORENSE_HARNESS_PY perdió sus barras invertidas").toBe(true);
    expect(FORENSE_HARNESS_PY.includes(String.raw`\s*paso:`), "FORENSE_HARNESS_PY perdió sus barras invertidas").toBe(true);
    // Regla del arnés (§5.4.1): sin acento grave ni ${ (romperían la plantilla o la interpolarían).
    expect(FORENSE_HARNESS_PY.includes("`"), "el arnés forense tiene un acento grave").toBe(false);
    expect(FORENSE_HARNESS_PY.includes("${"), "el arnés forense tiene una interpolación").toBe(false);
  });

  it("scripts/forge/bank-check/forense.py contiene el mismo arnés, byte por byte", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "forge", "bank-check", "forense.py"), "utf8").replace(/\r\n/g, "\n");
    const block = src.split("# --- harness (igual a FORENSE_HARNESS_PY) ---\n")[1]?.split("# --- fin del arnés ---")[0];
    expect(block?.trim(), "forense.py no contiene FORENSE_HARNESS_PY byte por byte").toBe(FORENSE_HARNESS_PY.trim());
  });
});
