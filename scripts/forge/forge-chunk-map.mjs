// ForgeChunkMapPlugin: webpack plugin WITHOUT dependencies that writes .next/forge-chunks.json from the MODULE
// GRAPH (design §6.7). Attribution by graph, never by text markers: a marker export does not survive
// minification and modules in a shared chunk lose it. next.config.mjs adds it only to the production client
// compilation (`!isServer && !dev`).
//
// Frozen format (phase 0, §22.3):
//   { v: 1,
//     chunks: { "<file of a chunk, relative to .next>": { pagina: boolean, forge: string[] } },
//     medios: { "<file emitted by a module>": "<repo-relative path of the Forge module>" } }
// Keys and paths are sorted. `pagina` is true for every file of the app/page chunk. Each chunk contributes one
// entry per file of chunk.files AND chunk.auxiliaryFiles (.js, .css, auxiliaries). `medios` lists what Forge
// modules emitted through this.emitFile (module.buildInfo.assets), including next/font/local fonts declared
// from src/forge/fonts/ (the `path` in the target.css query is the file that called localFont).
//
// It does not import webpack: Compilation and sources.RawSource come from compiler.webpack (Next's instance).
import path from "node:path";

export const FORGE_CHUNKS_FILE = "forge-chunks.json";
const PLUGIN = "ForgeChunkMapPlugin";

/** Repo-relative, forward-slash path of a module resource (query stripped). Pure. */
export function relResource(root, resource) {
  if (typeof resource !== "string" || !resource) return null;
  const noQuery = resource.split("?")[0];
  const abs = path.isAbsolute(noQuery) ? noQuery : path.join(root, noQuery);
  return path.relative(root, abs).split(path.sep).join("/").replace(/\\/g, "/");
}

/** True for paths that belong to the Forge world (what budget-report attributes). Pure. */
export function isForgePath(rel) {
  return typeof rel === "string" && (rel.startsWith("src/forge/") || rel.startsWith("content/forge/") || rel === "src/lib/spines-forge.ts");
}

/** For a next/font/local target.css module, the repo-relative path of the file that called localFont. Pure. */
export function localFontCaller(root, resource) {
  if (typeof resource !== "string") return null;
  const q = resource.indexOf("?");
  if (q < 0) return null;
  const file = resource.slice(0, q).replace(/\\/g, "/");
  if (!/\/next\/font\/local\/target\.css$/.test(file)) return null;
  let data;
  try {
    data = JSON.parse(resource.slice(q + 1));
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(resource.slice(q + 1)));
    } catch {
      return null;
    }
  }
  if (!data || typeof data.path !== "string") return null;
  return relResource(root, data.path.replace(/\\/g, "/"));
}

function moduleResource(m) {
  if (typeof m.resource === "string") return m.resource;
  if (typeof m.nameForCondition === "function") {
    try {
      const n = m.nameForCondition();
      if (typeof n === "string") return n;
    } catch {
      /* not every module type implements it */
    }
  }
  return null;
}

/** The Forge path a module is attributed to (its own resource, or the localFont caller), or null. */
export function forgeOwnerOf(root, m) {
  const res = moduleResource(m);
  const font = localFontCaller(root, res);
  if (font && font.startsWith("src/forge/fonts/")) return font;
  const rel = relResource(root, res);
  return isForgePath(rel) ? rel : null;
}

/** Build the map object from plain data (pure; the plugin feeds it). */
export function buildChunkMap(entries, medios) {
  const chunks = {};
  for (const k of Object.keys(entries).sort()) {
    chunks[k] = { pagina: entries[k].pagina, forge: [...entries[k].forge].sort() };
  }
  const med = {};
  for (const k of Object.keys(medios).sort()) med[k] = medios[k];
  return { v: 1, chunks, medios: med };
}

const isPageChunk = (chunk, file) => chunk.name === "app/page" || /(^|\/)app\/page-[^/]*$/.test(file);

export class ForgeChunkMapPlugin {
  constructor(opts = {}) {
    this.root = opts.root;
  }
  apply(compiler) {
    const root = this.root ?? compiler.context;
    const { Compilation, sources } = compiler.webpack;
    compiler.hooks.thisCompilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.processAssets.tap({ name: PLUGIN, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const entries = {};
        for (const chunk of compilation.chunks) {
          const forge = new Set();
          for (const m of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
            const own = forgeOwnerOf(root, m);
            if (own) forge.add(own);
            if (Array.isArray(m.modules)) {
              for (const inner of m.modules) {
                const o = forgeOwnerOf(root, inner);
                if (o) forge.add(o);
              }
            }
          }
          const files = [...(chunk.files ?? []), ...(chunk.auxiliaryFiles ?? [])];
          for (const file of files) {
            const prev = entries[file];
            const pagina = isPageChunk(chunk, file) || (prev?.pagina ?? false);
            const set = new Set([...(prev?.forge ?? []), ...forge]);
            entries[file] = { pagina, forge: set };
          }
        }
        const medios = {};
        for (const m of compilation.modules) {
          const assets = Object.keys(m.buildInfo?.assets ?? {});
          if (assets.length === 0) continue;
          const own = forgeOwnerOf(root, m);
          if (!own) continue;
          for (const a of assets) medios[a.replace(/\\/g, "/")] = own;
        }
        const map = buildChunkMap(entries, medios);
        compilation.emitAsset(FORGE_CHUNKS_FILE, new sources.RawSource(JSON.stringify(map, null, 1)));
      });
    });
  }
}

export default ForgeChunkMapPlugin;
