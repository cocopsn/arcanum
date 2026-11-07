import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Dexie from "dexie";

// §5.7, H13: «Evaluaciones» revalidates a seed row that still has old pendings before listing it. A row seeded with
// RET_DEFENSA and `pendientes` carrying its id, with the same md packaged, must list the retention WITHOUT «· sin
// verificar» once mounted (the first revalidation empties the pendings). Same banks-loader preparation as
// banks-loader.test.ts:6-42 (mock of bank-index.json and forgeBankSource.load).

const BANKS = vi.hoisted(() => ({ index: {} as Record<string, string>, md: {} as Record<string, string> }));
vi.mock("@/forge/data/bank-index.json", () => ({
  get default() {
    return BANKS.index;
  },
}));

import { forgeBankSource } from "@/forge/loaders";
import { saveExerciseBank, getBanksForModule } from "@/lib/exercise-store";
import { forgeCellId } from "@/forge/ids";
import { ForgeEvaluations } from "@/forge/ui/ForgeEvaluations";
import { project } from "@/core/projector";
import { RET_DEFENSA } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

forgeBankSource.load = async (code: string) => {
  const md = BANKS.md[code];
  if (md === undefined) throw new Error("chunk ausente");
  return md;
};

describe("ForgeEvaluations revalida un banco con pendientes viejos (§5.7)", () => {
  it("una fila sembrada con pendientes muestra la retención sin «· sin verificar»", async () => {
    const code = "F0-02";
    const cellId = forgeCellId(code);
    const md = bankMd([RET_DEFENSA], cellId, `Banco ${code}`);
    BANKS.index[code] = "0000000000";
    BANKS.md[code] = md;
    await saveExerciseBank(md, { source: "seed" });
    const row = (await getBanksForModule(cellId)).find((x) => x.source === "seed")!;
    // the row as a deploy left it while retencion's check was still a stub (same DB/table as exercise-store)
    const raw = new Dexie("arcanum-exercises");
    raw.version(1).stores({ banks: "id, moduleId, spine" });
    await raw.table("banks").update(row.id, { pendientes: [`${cellId}:ret-defensa`] });
    raw.close();

    render(<ForgeEvaluations code={code} cellId={cellId} readModel={project([])} />);
    await waitFor(() => expect(screen.queryByText(/Retención de la reserva/)).not.toBeNull());
    const boton = screen.getByText(/Retención de la reserva/).closest("button")!;
    expect(boton.textContent, "Evaluaciones no revalidó un banco con pendientes viejos").not.toContain("· sin verificar");
    cleanup();
  });
});
