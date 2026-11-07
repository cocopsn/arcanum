// Ejecución aislada de código JavaScript del modelo para los guiones del compañero (companion design §13.8, §22).
// El código del modelo nunca corre en el proceso del guion ni con `new Function` de Node: lo corre un proceso hijo
// `node --permission --allow-fs-read=<este archivo>` (sin lectura del resto del disco, sin escritura, sin child_process
// ni worker_threads) con el entorno VACÍO. El hijo recibe código, nombre de función y casos por stdin, los corre en
// `vm.runInNewContext` con `timeout` (3 s por omisión) y devuelve los resultados por stdout; el padre lo mata a los 5 s.
//
// Límites declarados: `vm` no es una frontera de seguridad (el código puede alcanzar el `process` del hijo); lo que
// protege es el modelo de permisos y el entorno vacío. El modelo de permisos de Node 24 no corta la red, pero el hijo no
// tiene secretos (entorno vacío, sin lectura de disco), así que no hay nada que exfiltrar. Tampoco impide que el código
// falsee la salida del hijo: sirve para medir, no para conceder nada.
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const ESTE = fileURLToPath(import.meta.url);

/** Igualdad estructural de valores JSON (el orden de las llaves no importa). */
function iguales(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && iguales(a[k], b[k]));
  }
  return false;
}

/**
 * Corre `codigo` y llama a `funcion` con cada `casos[i].input` en un hijo aislado.
 * `matarMs`, `vmMs`, `banderas`, `entorno` y `limpiar` existen para las pruebas y sus red-checks; los guiones usan los
 * valores por omisión.
 * @param {{ codigo: string, funcion: string, casos: { input: unknown[], expected: unknown }[] }} trabajo
 * @param {{ matarMs?: number, vmMs?: number, banderas?: string[], entorno?: Record<string, string>, limpiar?: boolean }} [opciones]
 * @returns {Promise<{ estado: "ok" | "tiempo" | "error" | "matado", ms: number, resultados?: { pasa: boolean, obtenido?: unknown, error?: string }[], error?: string, entornoAlNacer?: string[] }>}
 */
export function correrAislado(trabajo, { matarMs = 5000, vmMs = 3000, banderas, entorno = {}, limpiar = true } = {}) {
  return new Promise((resolve) => {
    const args = banderas ?? ["--permission", `--allow-fs-read=${ESTE}`];
    const t0 = Date.now();
    const hijo = spawn(process.execPath, [...args, ESTE, "--hijo"], { env: entorno, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let salida = "";
    let matado = false;
    let fin = false;
    const terminar = (r) => {
      if (fin) return;
      fin = true;
      clearTimeout(reloj);
      resolve({ ...r, ms: Date.now() - t0 });
    };
    const reloj = setTimeout(() => {
      matado = true;
      hijo.kill("SIGKILL");
    }, matarMs);
    hijo.stdout.setEncoding("utf8");
    hijo.stdout.on("data", (d) => {
      salida += d;
    });
    // stderr se descarta: puede traer texto del modelo y este guion no imprime lo que no conoce
    hijo.stderr.resume();
    hijo.on("error", (e) => terminar({ estado: "error", error: e.name }));
    hijo.on("close", (code) => {
      if (matado) return terminar({ estado: "matado" });
      try {
        terminar(JSON.parse(salida));
      } catch {
        terminar({ estado: "error", error: `el hijo salió con ${code} sin respuesta` });
      }
    });
    hijo.stdin.on("error", () => {});
    hijo.stdin.end(JSON.stringify({ ...trabajo, vmMs, limpiar }));
  });
}

/** El lado del hijo: lee el trabajo de stdin, lo corre en vm y escribe una sola línea JSON. */
async function hijo() {
  // Sólo los NOMBRES de las variables con que nació el hijo, para que la prueba mida el entorno que pasó el padre.
  const entornoAlNacer = Object.keys(process.env).sort();
  let entrada = "";
  process.stdin.setEncoding("utf8");
  for await (const c of process.stdin) entrada += c;
  const escribir = (o) => process.stdout.write(JSON.stringify({ ...o, entornoAlNacer }), () => process.exit(0));
  let t;
  try {
    t = JSON.parse(entrada);
  } catch {
    return escribir({ estado: "error", error: "trabajo ilegible" });
  }
  if (typeof t.codigo !== "string" || typeof t.funcion !== "string" || !/^[A-Za-z_$][\w$]*$/.test(t.funcion) || !Array.isArray(t.casos)) {
    return escribir({ estado: "error", error: "trabajo inválido" });
  }
  // En Windows libuv agrega al hijo las variables que considera obligatorias (PATH, SYSTEMROOT, USERNAME, TEMP…) aunque
  // el padre pase un entorno vacío; se borran antes de correr el código del modelo.
  if (t.limpiar !== false) for (const k of Object.keys(process.env)) delete process.env[k];
  // Sólo las entradas entran al contexto; lo esperado se compara afuera.
  const contexto = { __entradas: JSON.stringify(t.casos.map((c) => (Array.isArray(c?.input) ? c.input : []))) };
  const guion =
    `${t.codigo}\n;(function () { var __f = (${t.funcion}); return JSON.stringify(JSON.parse(__entradas).map(function (a) {` +
    ` try { return { ok: true, v: __f.apply(null, a) }; } catch (e) { return { ok: false, e: String(e && e.message || e) }; } })); })()`;
  let crudo;
  try {
    crudo = vm.runInNewContext(guion, contexto, { timeout: t.vmMs, microtaskMode: "afterEvaluate" });
  } catch (e) {
    if (e && e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") return escribir({ estado: "tiempo" });
    return escribir({ estado: "error", error: String((e && e.message) || e).slice(0, 300) });
  }
  let res;
  try {
    res = JSON.parse(String(crudo));
  } catch {
    return escribir({ estado: "error", error: "resultado ilegible" });
  }
  const resultados = t.casos.map((c, i) => {
    const r = res[i];
    if (!r || r.ok !== true) return { pasa: false, error: String(r?.e ?? "sin resultado").slice(0, 300) };
    return { pasa: iguales(r.v, c?.expected), obtenido: r.v };
  });
  return escribir({ estado: "ok", resultados });
}

if (process.argv[2] === "--hijo" && process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  hijo();
}
