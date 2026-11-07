import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";

// Diseño poblar §6.8 y §7.6: la lección no vive en el log. Si calificar falla SIN red, la respuesta se queda en pantalla,
// no se refuerza nada (ni passLesson ni resolveError) y UN evento `online` la reintenta una sola vez.

const actions = {
  generateLessonCourse: vi.fn(),
  gradeLessonStep: vi.fn(),
  resolveError: vi.fn(),
  passLesson: vi.fn(),
};
vi.mock("@/ui/use-actions", () => ({ useActions: () => actions }));
vi.mock("@/ui/reward/RewardProvider", () => ({ useReward: () => () => {} }));
vi.mock("@/lib/audio", () => ({ audio: { unlock: () => {}, sfx: () => {}, cue: () => {} } }));
vi.mock("@/ui/subject/EnterRitual", () => ({
  EnterRitual: ({ onDone }: { onDone: () => void }) => {
    useEffect(() => onDone(), [onDone]);
    return null;
  },
}));

import { LessonMode } from "@/ui/subject/LessonMode";
import { AI_QUEUED_LESSON_TEXT } from "@/lib/offline-texts";

const course = {
  concept: "Un índice convierte una búsqueda lineal en una logarítmica.",
  steps: [{ prompt: "¿Por qué un índice B-tree acelera un WHERE por igualdad?", rubric: ["menciona el árbol", "menciona log n"] }],
  provider: "test",
};

let online = true;
beforeEach(() => {
  online = true;
  vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
  actions.generateLessonCourse.mockResolvedValue(course);
  actions.gradeLessonStep.mockResolvedValue(null);
  actions.resolveError.mockReset();
  actions.passLesson.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  actions.gradeLessonStep.mockReset();
});

describe("LessonMode sin red (diseño poblar §6.8)", () => {
  it("keeps the answer on screen, reinforces nothing and retries ONCE when the network comes back", async () => {
    render(<LessonMode moduleId="m1" goalId="g1" goalTitle="ITC" cellTitle="Índices" onClose={() => {}} />);
    const field = (await screen.findByLabelText("Tu respuesta")) as HTMLTextAreaElement;
    const respuesta = "porque el árbol B reduce la búsqueda a log n niveles";
    fireEvent.change(field, { target: { value: respuesta } });

    online = false;
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(await screen.findByText(AI_QUEUED_LESSON_TEXT)).toBeInTheDocument();
    expect((screen.getByLabelText("Tu respuesta") as HTMLTextAreaElement).value, "sin red la respuesta de la lección se perdió").toBe(respuesta);
    expect(actions.passLesson).not.toHaveBeenCalled();
    expect(actions.resolveError).not.toHaveBeenCalled();
    expect(actions.gradeLessonStep).toHaveBeenCalledTimes(1);

    online = true;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(actions.gradeLessonStep).toHaveBeenCalledTimes(2));
    // un segundo `online` no vuelve a reintentar: un solo reintento por cada falla sin red
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(actions.gradeLessonStep).toHaveBeenCalledTimes(2);
  });

  it("with network a failed grade is the honest hiccup, not the offline hold", async () => {
    render(<LessonMode moduleId="m1" goalId="g1" goalTitle="ITC" cellTitle="Índices" onClose={() => {}} />);
    const field = await screen.findByLabelText("Tu respuesta");
    fireEvent.change(field, { target: { value: "una respuesta" } });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(await screen.findByText("La IA no respondió. Reintenta en un momento.")).toBeInTheDocument();
    expect(screen.queryByText(AI_QUEUED_LESSON_TEXT)).toBeNull();
  });
});
