// Pyodide: versión, archivos, tamaños e integridad (design poblar §6.3, H8). Una sola fuente para py-runner.ts (el
// worker que baja y guarda los seis archivos), sw.ts (la poda por versión al activar) y la fachada offline (estado,
// calentado y borrado). Los tamaños y los sha384 se midieron contra jsDelivr (2026-11-06 y otra vez el 2026-11-07).

export const PYODIDE_VERSION = "0.26.4";
export const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
/** Caché que escribe sólo el worker de Pyodide (el SW deja jsDelivr en NetworkOnly). */
export const PYODIDE_CACHE = "arcanum-pyodide";
/** Marca positiva del worker que guarda sus archivos; la sonda de producción la busca en los chunks (§15). */
export const PYODIDE_WORKER_REV = "cache-propio-1";

export const PYODIDE_CORE = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"] as const;
export const PYODIDE_SQLITE = ["sqlite3-1.0.0.zip"] as const;
export type PyodideFile = (typeof PYODIDE_CORE)[number] | (typeof PYODIDE_SQLITE)[number];

/** Bytes en el dispositivo (sin comprimir) y SRI de cada archivo. */
export const PYODIDE_FILES: Record<PyodideFile, { bytes: number; sri: string }> = {
  "pyodide.js": { bytes: 14_761, sri: "sha384-i3R37b3tF+HWudsUf1VSEOY2YxwSNMqY8DQa9Z0O3xh+NkJ9o+yjcGyIi5huj+nB" },
  "pyodide.asm.js": { bytes: 1_229_099, sri: "sha384-yZKhBBiP0ZceJh1RKKbMUfptsNLc0SyfFA4nZmJysRCsIJg0eYjy5Bonr0NN9U3X" },
  "pyodide.asm.wasm": { bytes: 10_088_051, sri: "sha384-UPLqVXovAmYvDGP3QsAICvyhkugIB8nhuGo3wgsxZD7DlcFDUSpYlRUfpwfq87uX" },
  "python_stdlib.zip": { bytes: 2_341_872, sri: "sha384-PawoekFvzx+5AUUlZ8VtwwUSpml23vie0wrGq/euGJEkRjl0FXWCXytybeVgbK5c" },
  "pyodide-lock.json": { bytes: 106_335, sri: "sha384-N3VHChchW0Cig+dw+pboPe9oVagcHuwzNGe4VFUqwaMPrEe/ewVorZ58G5lGQxHc" },
  "sqlite3-1.0.0.zip": { bytes: 1_454_039, sri: "sha384-V1TMBHONBYnU8kdhNyA5+vIZyodbcnC5/EesT4sTfnTEbFE+xDH+G6L//gnt1ha8" },
};

/** Los seis archivos con brotli (H8): lo que cuesta la primera descarga. */
export const PYODIDE_TRANSFER_BYTES = 6_106_785;

/** Los archivos que necesita un alcance: los cinco del núcleo y, con SQL, sqlite3. */
export function pyodideFilesFor(sqlite: boolean): PyodideFile[] {
  return sqlite ? [...PYODIDE_CORE, ...PYODIDE_SQLITE] : [...PYODIDE_CORE];
}
