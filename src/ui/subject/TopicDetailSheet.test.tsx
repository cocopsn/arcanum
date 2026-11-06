import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { TopicDetailSheet } from "@/ui/subject/TopicDetailSheet";
import { createDb } from "@/db/schema";
import { SPINES } from "@/lib/spines";

afterEach(cleanup);

// D14: under a full parallel vitest run (15 agents on one machine) the default 1 s waitFor and 5 s test timeout
// expired once. Explicit, documented limits; the assertions are unchanged.
const LOAD_TIMEOUT = 15_000;
const TEST_TIMEOUT = 30_000;

// On a fresh universe the 2nd cell of every spine is SEALED (its prereq — the first cell — is not
// yet mastered). The bug was: a sealed cell opened its work flow anyway (visual block, not real).
const sealed = SPINES.map((s) => ({ goal: s.goalTitle, id: s.cells[1]!.id }));

describe("TopicDetailSheet — fog-of-war is FAIL-CLOSED uniformly across the 4 spines", () => {
  for (const c of sealed) {
    it(`a sealed cell in ${c.goal} shows the locked state and NOT the work flow`, async () => {
      const db = createDb(`fog-${c.goal.replace(/\W/g, "")}-${Math.round(performance.now())}-${Math.random()}`);
      render(
        <ArcanumProvider db={db}>
          <TopicDetailSheet moduleId={c.id} accent="#3f74e8" onClose={() => {}} />
        </ArcanumProvider>,
      );
      await waitFor(() => expect(screen.getByText(/Territorio sellado/)).toBeInTheDocument(), { timeout: LOAD_TIMEOUT });
      // the work flow must be unreachable: no mode selector, no "start", no mission/lesson controls
      expect(screen.queryByText(/¿Cuánto tiempo tienes/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Iniciar tópico/)).not.toBeInTheDocument();
      await db.delete();
    }, TEST_TIMEOUT);
  }

  it("the first (AVAILABLE) cell DOES open its selector + work flow", async () => {
    const db = createDb(`avail-${Math.round(performance.now())}-${Math.random()}`);
    render(
      <ArcanumProvider db={db}>
        <TopicDetailSheet moduleId={SPINES[0]!.cells[0]!.id} accent="#3f74e8" onClose={() => {}} />
      </ArcanumProvider>,
    );
    await waitFor(() => expect(screen.getByText(/¿Cuánto tiempo tienes/)).toBeInTheDocument(), { timeout: LOAD_TIMEOUT });
    expect(screen.queryByText(/Territorio sellado/)).not.toBeInTheDocument();
    await db.delete();
  }, TEST_TIMEOUT);
});
