import c1Md from "../../content/exercises/itc-c1.md";
import c2Md from "../../content/exercises/itc-c2.md";
import c3Md from "../../content/exercises/itc-c3.md";
import c4Md from "../../content/exercises/itc-c4.md";
import c7Md from "../../content/exercises/itc-c7.md";
import c8Md from "../../content/exercises/itc-c8.md";
// FrED Operativo (the ORION Bridge track) — one bank per seeded node, anchored to its r2 reading.
import op0Md from "../../content/exercises/fred-op-0.md";
import op1Md from "../../content/exercises/fred-op-1.md";
import op2Md from "../../content/exercises/fred-op-2.md";
import op3Md from "../../content/exercises/fred-op-3.md";
import op4Md from "../../content/exercises/fred-op-4.md";
import op5Md from "../../content/exercises/fred-op-5.md";
import op6Md from "../../content/exercises/fred-op-6.md";
import op7Md from "../../content/exercises/fred-op-7.md";
import op8Md from "../../content/exercises/fred-op-8.md";
// Competitiva (ICPC) — reconocimiento de patrón bajo el reloj; una banca por celda-patrón (cp1..cp8).
import cp1Md from "../../content/exercises/cp1.md";
import cp2Md from "../../content/exercises/cp2.md";
import cp3Md from "../../content/exercises/cp3.md";
import cp4Md from "../../content/exercises/cp4.md";
import cp5Md from "../../content/exercises/cp5.md";
import cp6Md from "../../content/exercises/cp6.md";
import cp7Md from "../../content/exercises/cp7.md";
import cp8Md from "../../content/exercises/cp8.md";
// Alemán — PRODUCCIÓN (construir frases + explicar el porqué), anclado a los libros deep A1/A2.
import deA1Md from "../../content/exercises/de-a1.md";
import deA2Md from "../../content/exercises/de-a2.md";
// OA Amazon — el path de asalto al Online Assessment: un banco CRONOMETRADO por celda (tiempo: en
// cada ejercicio), anclado al libro oa-N de su nodo. Reconocimiento estilo-Amazon + drills en ambos
// lenguajes + parche-de-bug (oa-12) + producción (SQL/Work Simulation). El juez real es el OA.
import oa0Md from "../../content/exercises/oa-0.md";
import oa1Md from "../../content/exercises/oa-1.md";
import oa2Md from "../../content/exercises/oa-2.md";
import oa3Md from "../../content/exercises/oa-3.md";
import oa4Md from "../../content/exercises/oa-4.md";
import oa5Md from "../../content/exercises/oa-5.md";
import oa6Md from "../../content/exercises/oa-6.md";
import oa7Md from "../../content/exercises/oa-7.md";
import oa8Md from "../../content/exercises/oa-8.md";
import oa9Md from "../../content/exercises/oa-9.md";
import oa10Md from "../../content/exercises/oa-10.md";
import oa11Md from "../../content/exercises/oa-11.md";
import oa12Md from "../../content/exercises/oa-12.md";
import oa13Md from "../../content/exercises/oa-13.md";
import { parseExercisesMd } from "@/lib/exercises-md";
import { slugify } from "@/lib/book";
import { getBank, saveExerciseBank } from "@/lib/exercise-store";

// The bundled seed EXAMPLE exercise banks (content/exercises/*.md) — the migration of the old hardcoded
// ITC C1-C4 bank into the .md contract. They ship with the app so the exercises work offline out of the
// box; they are meant to be joined/replaced by banks the user generates externally (Sonnet 5) and imports.
// Seeding trusts the python refs (they are validated at build time by the round-trip test — Pyodide isn't
// available at first offline launch) and re-validates the JS refs via execCode (real, offline).
export const SEED_EXERCISE_MD: string[] = [
  c1Md, c2Md, c3Md, c4Md, c7Md, c8Md,
  op0Md, op1Md, op2Md, op3Md, op4Md, op5Md, op6Md, op7Md, op8Md,
  cp1Md, cp2Md, cp3Md, cp4Md, cp5Md, cp6Md, cp7Md, cp8Md,
  deA1Md, deA2Md,
  oa0Md, oa1Md, oa2Md, oa3Md, oa4Md, oa5Md, oa6Md, oa7Md, oa8Md, oa9Md, oa10Md, oa11Md, oa12Md, oa13Md,
];

/** Populate the offline exercise store with the seed banks — IDEMPOTENT: only seeds a bank id that has no
 *  entry yet, so a re-seed never clobbers a user's imported bank. Best-effort (offline cache). */
export async function seedExerciseBanks(): Promise<void> {
  for (const md of SEED_EXERCISE_MD) {
    const parsed = parseExercisesMd(md);
    if (!parsed) continue;
    const id = parsed.meta.moduleId ?? slugify(parsed.meta.title);
    if (await getBank(id)) continue; // already present (seed or user import) → leave it
    await saveExerciseBank(md, { source: "seed" });
  }
}
