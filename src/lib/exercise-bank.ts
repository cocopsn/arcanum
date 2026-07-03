import type { CodeExercise, ChoiceExercise, Exercise, TestCase, QualityPattern } from "@/lib/exercise";

// LAYER 1 — the CURATED bank (authored here, in the build). Rich exercises anchored to ITC cells C1-C4,
// in JS AND Python, with 0.1% rigor: the test cases carry the EDGE cases (empty, single, degeneration),
// not just the happy path. The learner writes the implementation from scratch; the starter is only the
// signature + a TODO — never the solution. Reference solutions live here (shown at the end / on the
// honest fallback), and every one passes its OWN cases (guarded by exercise-bank.test.ts).

// ITC cell ids (from spines.ts)
const C1 = "ca000000-0000-4000-8000-000000000002"; // asintótico / invariantes
const C2 = "ca000000-0000-4000-8000-000000000003"; // estructuras lineales
const C3 = "ca000000-0000-4000-8000-000000000004"; // hashing
const C4 = "ca000000-0000-4000-8000-000000000005"; // árboles

interface CodeBase {
  id: string;
  moduleId: string;
  title: string;
  statement: string;
  pseudocode: string;
  testCases: TestCase[];
  hints?: string[];
  patterns?: QualityPattern[];
}
interface Fn {
  name: string;
  starter: string;
  solution: string;
}

/** Emit a JS + Python pair sharing the same (language-agnostic) test cases. */
function pair(base: CodeBase, js: Fn, python: Fn): CodeExercise[] {
  const common = { kind: "code" as const, moduleId: base.moduleId, title: base.title, statement: base.statement, pseudocode: base.pseudocode, testCases: base.testCases, hints: base.hints ?? [], patterns: base.patterns ?? [], source: "curated" as const };
  return [
    { ...common, id: `${base.id}-js`, lang: "js", functionName: js.name, starter: js.starter, referenceSolution: js.solution },
    { ...common, id: `${base.id}-py`, lang: "python", functionName: python.name, starter: python.starter, referenceSolution: python.solution },
  ];
}
/** A JS-only code exercise (used where the input shape doesn't convert cleanly to Python, e.g. trees). */
function jsOnly(base: CodeBase, js: Fn): CodeExercise {
  return { kind: "code", id: `${base.id}-js`, moduleId: base.moduleId, lang: "js", title: base.title, statement: base.statement, pseudocode: base.pseudocode, functionName: js.name, starter: js.starter, testCases: base.testCases, referenceSolution: js.solution, hints: base.hints ?? [], patterns: base.patterns ?? [], source: "curated" };
}
function choice(id: string, moduleId: string, title: string, statement: string, options: string[], answer: number, rationale: string): ChoiceExercise {
  return { kind: "choice", id, moduleId, title, statement, options, answer, rationale, source: "curated" };
}

export const EXERCISE_BANK: Exercise[] = [
  // ── C1 · asintótico / invariantes ──────────────────────────────────────────────────────────
  choice("c1-complexity-nested", C1, "Complejidad de un lazo anidado", "¿Cuál es la complejidad en tiempo de `for i in 0..n: for j in 0..n: op()`?", ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"], 2, "Dos lazos anidados que recorren n cada uno ejecutan la operación n·n = n² veces. La complejidad la fija la cantidad de operaciones en función de la entrada, no el número de líneas."),
  choice("c1-complexity-binsearch", C1, "Complejidad de la búsqueda binaria", "En un arreglo ORDENADO de n elementos, ¿cuántas comparaciones hace la búsqueda binaria en el peor caso?", ["n", "n/2", "log₂(n)", "√n"], 2, "Cada comparación DESCARTA la mitad del espacio restante, así que el número de pasos es cuántas veces divides n entre 2 hasta llegar a 1: log₂(n). Ese logaritmo ES la garantía del orden."),
  ...pair(
    { id: "c1-linear-search", moduleId: C1, title: "Búsqueda lineal", statement: "Devuelve el ÍNDICE de la primera aparición de `target` en `a`, o -1 si no está. No uses indexOf/index.", pseudocode: "linearSearch(a, target): recorre i de 0 a n-1; si a[i] === target devuelve i; si terminas, -1.",
      testCases: [
        { input: [[], 3], expected: -1 },
        { input: [[3], 3], expected: 0 },
        { input: [[5, 1, 3, 3], 3], expected: 2 },
        { input: [[1, 2, 4], 3], expected: -1 },
        { input: [[7, 7, 7], 7], expected: 0 },
      ], hints: ["Necesitas el índice, no el valor: itera con un contador.", "El vacío devuelve -1 sin entrar al lazo."] },
    { name: "linearSearch", starter: "function linearSearch(a, target) {\n  // tu código\n}", solution: "function linearSearch(a, target) {\n  for (let i = 0; i < a.length; i++) if (a[i] === target) return i;\n  return -1;\n}" },
    { name: "linear_search", starter: "def linear_search(a, target):\n    # tu código\n    pass", solution: "def linear_search(a, target):\n    for i in range(len(a)):\n        if a[i] == target:\n            return i\n    return -1" },
  ),

  // ── C2 · estructuras lineales ──────────────────────────────────────────────────────────────
  ...pair(
    { id: "c2-balanced", moduleId: C2, title: "Paréntesis balanceados (pila)", statement: "Devuelve true si la cadena de `()[]{}` está balanceada (cada apertura cierra en orden). Vacía = true.", pseudocode: "isBalanced(s): usa una PILA; al abrir empuja el cierre esperado; al cerrar, debe coincidir con el tope; al final la pila debe estar vacía.",
      testCases: [
        { input: [""], expected: true },
        { input: ["()"], expected: true },
        { input: ["([{}])"], expected: true },
        { input: ["(]"], expected: false },
        { input: ["("], expected: false },
        { input: [")("], expected: false },
      ], hints: ["Una pila: apila lo que esperas cerrar.", "Cerrar con la pila vacía ya es falso."], patterns: [{ test: "\\.replace\\(", message: "Resolverlo con replace repetido funciona pero O(n²); la PILA es el patrón O(n) idiomático." }] },
    { name: "isBalanced", starter: "function isBalanced(s) {\n  // tu código\n}", solution: "function isBalanced(s) {\n  const close = { '(': ')', '[': ']', '{': '}' };\n  const st = [];\n  for (const c of s) {\n    if (close[c]) st.push(close[c]);\n    else if (st.pop() !== c) return false;\n  }\n  return st.length === 0;\n}" },
    { name: "is_balanced", starter: "def is_balanced(s):\n    # tu código\n    pass", solution: "def is_balanced(s):\n    close = {'(': ')', '[': ']', '{': '}'}\n    st = []\n    for c in s:\n        if c in close:\n            st.append(close[c])\n        elif not st or st.pop() != c:\n            return False\n    return len(st) == 0" },
  ),
  ...pair(
    { id: "c2-rotate", moduleId: C2, title: "Rotar un arreglo k a la derecha", statement: "Devuelve un NUEVO arreglo rotado k posiciones a la derecha. k puede ser mayor que la longitud.", pseudocode: "rotate(a, k): normaliza k = k mod n; el resultado es los últimos k seguidos de los primeros n-k.",
      testCases: [
        { input: [[], 3], expected: [] },
        { input: [[1], 5], expected: [1] },
        { input: [[1, 2, 3, 4], 1], expected: [4, 1, 2, 3] },
        { input: [[1, 2, 3, 4], 4], expected: [1, 2, 3, 4] },
        { input: [[1, 2, 3, 4], 6], expected: [3, 4, 1, 2] },
      ], hints: ["k mod n evita rotar de más.", "Ojo con n=0 (evita dividir entre cero)."] },
    { name: "rotate", starter: "function rotate(a, k) {\n  // tu código\n}", solution: "function rotate(a, k) {\n  const n = a.length;\n  if (n === 0) return [];\n  const s = ((k % n) + n) % n;\n  return a.slice(n - s).concat(a.slice(0, n - s));\n}" },
    { name: "rotate", starter: "def rotate(a, k):\n    # tu código\n    pass", solution: "def rotate(a, k):\n    n = len(a)\n    if n == 0:\n        return []\n    s = k % n\n    return a[n - s:] + a[:n - s]" },
  ),

  // ── C3 · hashing ───────────────────────────────────────────────────────────────────────────
  ...pair(
    { id: "c3-two-sum", moduleId: C3, title: "Two-sum (índices, con hash)", statement: "Devuelve los índices [i, j] (i<j) de los DOS números que suman `target`. Hay exactamente una respuesta. Hazlo en O(n) con un mapa (no O(n²)).", pseudocode: "twoSum(a, target): recorre; para cada a[i] busca si el complemento (target - a[i]) ya se vio en un MAPA valor→índice; si sí, devuelve [índiceVisto, i]; si no, guarda a[i]→i.",
      testCases: [
        { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { input: [[3, 2, 4], 6], expected: [1, 2] },
        { input: [[3, 3], 6], expected: [0, 1] },
        { input: [[-1, -2, -3, -4], -7], expected: [2, 3] },
      ], hints: ["El mapa recuerda qué valores ya viste y en qué índice.", "Busca el COMPLEMENTO antes de guardar el actual."], patterns: [{ test: "for\\s*\\([^)]*\\)[^]*for\\s*\\(", message: "Dos lazos anidados es O(n²); el MAPA lo hace O(n) — ese es el punto de la celda de hashing." }] },
    { name: "twoSum", starter: "function twoSum(a, target) {\n  // tu código\n}", solution: "function twoSum(a, target) {\n  const seen = new Map();\n  for (let i = 0; i < a.length; i++) {\n    const need = target - a[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(a[i], i);\n  }\n  return [];\n}" },
    { name: "two_sum", starter: "def two_sum(a, target):\n    # tu código\n    pass", solution: "def two_sum(a, target):\n    seen = {}\n    for i, x in enumerate(a):\n        need = target - x\n        if need in seen:\n            return [seen[need], i]\n        seen[x] = i\n    return []" },
  ),
  ...pair(
    { id: "c3-first-unique", moduleId: C3, title: "Primer elemento sin repetir", statement: "Devuelve el ÍNDICE del primer elemento que aparece exactamente una vez, o -1 si todos se repiten. Dos pasadas con un conteo (hash).", pseudocode: "firstUnique(a): 1) cuenta apariciones en un mapa; 2) recorre en orden y devuelve el índice del primero con conteo 1.",
      testCases: [
        { input: [[]], expected: -1 },
        { input: [[7]], expected: 0 },
        { input: [[2, 2, 3, 3]], expected: -1 },
        { input: [[4, 5, 4, 6]], expected: 1 },
        { input: [[1, 1, 2]], expected: 2 },
      ], hints: ["Primero cuenta TODO, luego busca el primer conteo == 1.", "El orden importa: recorre el arreglo, no las llaves del mapa."] },
    { name: "firstUnique", starter: "function firstUnique(a) {\n  // tu código\n}", solution: "function firstUnique(a) {\n  const cnt = new Map();\n  for (const x of a) cnt.set(x, (cnt.get(x) || 0) + 1);\n  for (let i = 0; i < a.length; i++) if (cnt.get(a[i]) === 1) return i;\n  return -1;\n}" },
    { name: "first_unique", starter: "def first_unique(a):\n    # tu código\n    pass", solution: "def first_unique(a):\n    cnt = {}\n    for x in a:\n        cnt[x] = cnt.get(x, 0) + 1\n    for i, x in enumerate(a):\n        if cnt[x] == 1:\n            return i\n    return -1" },
  ),
  choice("c3-hash-expected", C3, "¿Por qué O(1) esperado y no garantizado?", "Una tabla hash con encadenamiento da búsqueda O(1) ESPERADO. ¿Cuándo degenera a O(n)?", ["Nunca — siempre es O(1)", "Cuando la tabla está vacía", "Cuando muchas/todas las llaves colisionan al mismo bucket", "Cuando el arreglo está ordenado"], 2, "O(1) esperado asume hashing uniforme (las llaves se reparten). Si una función hash adversarial (o mala suerte) manda todo al mismo bucket, esa cadena tiene longitud n → la búsqueda recorre n. Por eso es esperado, no garantizado."),

  // ── C4 · árboles (JS-only: el árbol es un objeto anidado {val,left,right}) ────────────────────
  jsOnly(
    { id: "c4-tree-height", moduleId: C4, title: "Altura de un árbol binario", statement: "Dado un nodo `{ val, left, right }` (o null), devuelve su ALTURA: el árbol vacío (null) tiene altura -1, una hoja tiene altura 0.", pseudocode: "height(node): si node es null → -1; si no → 1 + max(height(izq), height(der)). Recursión pura.",
      testCases: [
        { input: [null], expected: -1 },
        { input: [{ val: 1, left: null, right: null }], expected: 0 },
        { input: [{ val: 1, left: { val: 2, left: null, right: null }, right: null }], expected: 1 },
        { input: [{ val: 8, left: { val: 4, left: { val: 2, left: null, right: null }, right: null }, right: { val: 12, left: null, right: null } }], expected: 2 },
      ], hints: ["El caso base es null → -1 (así una hoja da 0).", "Combina las dos alturas con max y suma 1."] },
    { name: "height", starter: "function height(node) {\n  // node es { val, left, right } o null\n}", solution: "function height(node) {\n  if (node === null) return -1;\n  return 1 + Math.max(height(node.left), height(node.right));\n}" },
  ),
  jsOnly(
    { id: "c4-inorder", moduleId: C4, title: "Recorrido inorden (BST → ordenado)", statement: "Dado un nodo `{ val, left, right }` (o null), devuelve un arreglo con los valores en INORDEN (izquierda, raíz, derecha). En un BST esto sale ordenado.", pseudocode: "inorder(node): si null → []; si no → inorder(izq) ++ [val] ++ inorder(der).",
      testCases: [
        { input: [null], expected: [] },
        { input: [{ val: 5, left: null, right: null }], expected: [5] },
        { input: [{ val: 2, left: { val: 1, left: null, right: null }, right: { val: 3, left: null, right: null } }], expected: [1, 2, 3] },
      ], hints: ["Inorden = izquierda, luego raíz, luego derecha.", "Concatena los tres pedazos."] },
    { name: "inorder", starter: "function inorder(node) {\n  // node es { val, left, right } o null\n}", solution: "function inorder(node) {\n  if (node === null) return [];\n  return [...inorder(node.left), node.val, ...inorder(node.right)];\n}" },
  ),
  choice("c4-avl-recurrence", C4, "La recurrencia de la altura AVL", "El número MÍNIMO de nodos de un AVL de altura h cumple N(h) = 1 + N(h-1) + N(h-2). ¿Por qué NO es N(h) = 1 + 2·N(h-1)?", ["Porque los AVL no tienen dos hijos", "Porque un subárbol puede tener altura h-2 sin romper el balance (|dif| ≤ 1)", "Porque la raíz cuenta doble", "Es un error, sí debería ser 2·N(h-1)"], 1, "Para MINIMIZAR nodos a altura h, un subárbol llega a h-1 (para dar la altura) y el otro se hace lo más flaco permitido: h-2 (la invariante AVL permite diferencia de 1). Por eso 1 + N(h-1) + N(h-2) — la recurrencia de Fibonacci, de donde sale h = O(log n)."),
];

/** Curated exercises anchored to a cell. */
export function bankForModule(moduleId: string): Exercise[] {
  return EXERCISE_BANK.filter((e) => e.moduleId === moduleId);
}
