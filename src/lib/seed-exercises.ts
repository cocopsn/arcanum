import c1Md from "../../content/exercises/itc-c1.md";
import c2Md from "../../content/exercises/itc-c2.md";
import c3Md from "../../content/exercises/itc-c3.md";
import c4Md from "../../content/exercises/itc-c4.md";
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
import { parseExercisesMd } from "@/lib/exercises-md";
import { slugify } from "@/lib/book";
import { getBank, saveExerciseBank } from "@/lib/exercise-store";

// The bundled seed EXAMPLE exercise banks (content/exercises/*.md) — the migration of the old hardcoded
// ITC C1-C4 bank into the .md contract. They ship with the app so the exercises work offline out of the
// box; they are meant to be joined/replaced by banks the user generates externally (Sonnet 5) and imports.
// Seeding trusts the python refs (they are validated at build time by the round-trip test — Pyodide isn't
// available at first offline launch) and re-validates the JS refs via execCode (real, offline).
export const SEED_EXERCISE_MD: string[] = [c1Md, c2Md, c3Md, c4Md, op0Md, op1Md, op2Md, op3Md, op4Md, op5Md, op6Md, op7Md, op8Md];

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
