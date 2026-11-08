// Cargador local de la Edge ai-router (companion design §13.8). Lee el fuente de Deno (o una copia en memoria que sólo
// pasan los red-checks), quita el import de esm.sh, lo transpila con typescript (transpileModule, ES2022) y lo evalúa con
// `Deno`, `fetch` y `createClient` inyectados, como loadEdge de src/lib/ai-router-filter.test.ts. getUser devuelve un
// usuario con id rotativo para no tropezar con el límite por usuario de la Edge (12 por minuto).
// No imprime nada: las llaves del entorno sólo viven dentro de `env`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const RUTA_EDGE = fileURLToPath(new URL("../../supabase/functions/ai-router/index.ts", import.meta.url));

/**
 * @param {{ env: Record<string, string | undefined>, fetch: typeof globalThis.fetch, fuente?: string }} opciones
 * @returns {{ handler: (req: Request) => Promise<Response>, invocar: (body: unknown) => Promise<{ status: number, json: Record<string, unknown> }> }}
 */
export function cargarEdge({ env, fetch, fuente }) {
  const source = fuente ?? readFileSync(RUTA_EDGE, "utf8");
  const sinImport = source.replace(/^import [^\n]*\n/m, "");
  if (sinImport === source) throw new Error("el fuente de la Edge ya no importa de esm.sh: revisa el cargador");
  const js = ts
    .transpileModule(sinImport, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    .outputText.replace(/^export \{\};?\s*$/m, "");
  /** @type {{ handler?: (req: Request) => Promise<Response> }} */
  const servido = {};
  const Deno = {
    env: { get: (/** @type {string} */ k) => env[k] },
    serve: (/** @type {(req: Request) => Promise<Response>} */ h) => {
      servido.handler = h;
    },
  };
  let turno = 0;
  const createClient = () => ({
    auth: { getUser: async () => ({ data: { user: { id: `local-${++turno}` } } }) },
  });
  new Function("Deno", "fetch", "createClient", js)(Deno, fetch, createClient);
  const handler = servido.handler;
  if (!handler) throw new Error("ai-router no llamó a Deno.serve");
  /** @param {unknown} body */
  const invocar = async (body) => {
    const res = await handler(
      new Request("https://edge.local/ai-router", {
        method: "POST",
        headers: { Authorization: "Bearer local", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, json: /** @type {Record<string, unknown>} */ (await res.json()) };
  };
  return { handler, invocar };
}
