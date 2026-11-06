// c · historial, modo traza: the step language (design §9.3 c). A CLOSED grammar read by a recursive-descent parser,
// with NO eval: a program here is data, never code. Steps:
//   leer <var> -> <reg>        escribir <var> = <expr>      validar <expr>
//   bloquear <candado>          liberar <candado>             cas <var> <reg> <expr>      commit
// <expr>: integers, registers and variables with + − (or -) > >= < <= == != and parentheses (&& and || are accepted
// to join comparisons). A name resolves to the actor's register if it has one, else to the shared variable.

export type Expr =
  | { k: "num"; v: number }
  | { k: "name"; n: string }
  | { k: "bin"; op: BinOp; a: Expr; b: Expr };
export type BinOp = "+" | "-" | ">" | ">=" | "<" | "<=" | "==" | "!=" | "&&" | "||";

export type Step =
  | { k: "leer"; v: string; reg: string }
  | { k: "escribir"; v: string; e: Expr }
  | { k: "validar"; e: Expr }
  | { k: "bloquear"; c: string }
  | { k: "liberar"; c: string }
  | { k: "cas"; v: string; reg: string; e: Expr }
  | { k: "commit" };

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Tok = { t: "num"; v: number } | { t: "name"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] | string {
  const out: Tok[] = [];
  const s = src.replace(/\u2212/g, "-");
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-<>()".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    const num = s.slice(i).match(/^\d+/);
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const nm = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (nm) {
      out.push({ t: "name", v: nm[0] });
      i += nm[0].length;
      continue;
    }
    return `símbolo no permitido «${c}»`;
  }
  return out;
}

const PREC: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, ">": 4, ">=": 4, "<": 4, "<=": 4, "+": 5, "-": 5 };

/** Parse an expression of the closed grammar. Returns the tree or the error. */
export function parseExpr(src: string): Expr | string {
  const lexed = tokenize(src);
  if (typeof lexed === "string") return lexed;
  const toks: Tok[] = lexed;
  let p = 0;
  function primary(): Expr | string {
    const t = toks[p];
    if (!t) return "expresión incompleta";
    if (t.t === "num") {
      p++;
      return { k: "num", v: t.v };
    }
    if (t.t === "name") {
      p++;
      return { k: "name", n: t.v };
    }
    if (t.v === "(") {
      p++;
      const e = binary(0);
      if (typeof e === "string") return e;
      if (toks[p]?.t !== "op" || toks[p]!.v !== ")") return "falta «)»";
      p++;
      return e;
    }
    if (t.v === "-") {
      p++;
      const e = primary();
      if (typeof e === "string") return e;
      return { k: "bin", op: "-", a: { k: "num", v: 0 }, b: e };
    }
    return `«${t.v}» fuera de lugar`;
  }
  function binary(min: number): Expr | string {
    let left = primary();
    if (typeof left === "string") return left;
    for (;;) {
      const t = toks[p];
      if (!t || t.t !== "op" || !(t.v in PREC) || PREC[t.v]! < min) return left;
      p++;
      const right = binary(PREC[t.v]! + 1);
      if (typeof right === "string") return right;
      left = { k: "bin", op: t.v as BinOp, a: left, b: right };
    }
  }
  const e = binary(0);
  if (typeof e === "string") return e;
  if (p !== toks.length) return `sobra «${(toks[p] as { v: unknown }).v}»`;
  return e;
}

/** Parse one step of the closed language. */
export function parseStep(src: string): Step | string {
  const s = src.trim();
  let m = s.match(/^leer\s+(\S+)\s*->\s*(\S+)$/);
  if (m) return NAME.test(m[1]!) && NAME.test(m[2]!) ? { k: "leer", v: m[1]!, reg: m[2]! } : `nombre no válido en «${s}»`;
  m = s.match(/^escribir\s+(\S+)\s*=\s*(.+)$/);
  if (m) {
    if (!NAME.test(m[1]!)) return `nombre no válido en «${s}»`;
    const e = parseExpr(m[2]!);
    return typeof e === "string" ? `«${s}»: ${e}` : { k: "escribir", v: m[1]!, e };
  }
  m = s.match(/^validar\s+(.+)$/);
  if (m) {
    const e = parseExpr(m[1]!);
    return typeof e === "string" ? `«${s}»: ${e}` : { k: "validar", e };
  }
  m = s.match(/^(bloquear|liberar)\s+(\S+)$/);
  if (m) return NAME.test(m[2]!) ? (m[1] === "bloquear" ? { k: "bloquear", c: m[2]! } : { k: "liberar", c: m[2]! }) : `nombre no válido en «${s}»`;
  m = s.match(/^cas\s+(\S+)\s+(\S+)\s+(.+)$/);
  if (m) {
    if (!NAME.test(m[1]!) || !NAME.test(m[2]!)) return `nombre no válido en «${s}»`;
    const e = parseExpr(m[3]!);
    return typeof e === "string" ? `«${s}»: ${e}` : { k: "cas", v: m[1]!, reg: m[2]!, e };
  }
  if (s === "commit") return { k: "commit" };
  return `paso fuera del lenguaje: «${s}»`;
}

export type Value = number | boolean;

/** Evaluate an expression with a name resolver. Throws with a message on an unknown name or a type mix. */
export function evalExpr(e: Expr, lookup: (name: string) => number | undefined): Value {
  if (e.k === "num") return e.v;
  if (e.k === "name") {
    const v = lookup(e.n);
    if (v === undefined) throw new Error(`«${e.n}» no está definido`);
    return v;
  }
  const a = evalExpr(e.a, lookup);
  const b = evalExpr(e.b, lookup);
  if (e.op === "&&" || e.op === "||") {
    if (typeof a !== "boolean" || typeof b !== "boolean") throw new Error(`«${e.op}» une comparaciones`);
    return e.op === "&&" ? a && b : a || b;
  }
  if (e.op === "==" || e.op === "!=") return e.op === "==" ? a === b : a !== b;
  if (typeof a !== "number" || typeof b !== "number") throw new Error(`«${e.op}» necesita números`);
  switch (e.op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    default:
      return a <= b;
  }
}
