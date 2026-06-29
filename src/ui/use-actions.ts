"use client";

import { useArcanumStore, useArcanumSync } from "@/app/providers";
import { makeEvent, newEventId, type EventType, type Json } from "@/core/event";
import { getDeviceId } from "@/lib/device";
import { buildEvaluationContext, heuristicEvaluation } from "@/core/evaluation";
import { requestModuleEvaluation } from "@/sync/ai";

interface Refs {
  goalId?: string | null;
  moduleId?: string | null;
}

/** Bound event dispatchers — stamp now + device id, then push to the mirror. */
export function useActions() {
  const store = useArcanumStore();
  const { syncNow } = useArcanumSync();

  async function fire(type: EventType, payload: Json, refs: Refs = {}): Promise<void> {
    const now = Date.now();
    const event = makeEvent(type, payload, {
      ts: now,
      deviceId: getDeviceId(),
      goalId: refs.goalId ?? null,
      moduleId: refs.moduleId ?? null,
    });
    await store.getState().dispatch(event, now);
    syncNow(); // fire-and-forget; offline queue holds until a session/network exists
  }

  return {
    fire,
    resolveError: (refs: Refs, insight: string) => fire("error.resolved", { insight }, refs),
    logError: (refs: Refs, description: string) => fire("error.logged", { description }, refs),
    startModule: (refs: Refs) => fire("module.started", {}, refs),
    completeModule: (refs: Refs) => fire("module.completed", {}, refs),
    submitFiretest: (refs: Refs, reached: number, ceiling: number) =>
      fire("firetest.attempted", { reached, ceiling }, refs),
    // Built-in topic quiz (Bloque 4): score ∈ [0,1] reinforces mastery + XP via the
    // existing checkpoint.passed path. No new event type — the quiz IS a checkpoint.
    submitQuiz: (refs: Refs, score: number) =>
      fire("checkpoint.passed", { score, kind: "checkpoint" }, refs),
    // Adversarial per-module evaluation (Bloque 5): build the context from the log,
    // try the AI router, fall back to the local heuristic, record as module.evaluated
    // (auditable). The numeric score is always the real heuristic read of mastery.
    evaluateModule: async (moduleId: string): Promise<void> => {
      const now = Date.now();
      const rm = store.getState().readModel;
      const events = await store.getState().getEvents();
      const ctx = buildEvaluationContext(rm, events, moduleId, now);
      if (!ctx) return;
      const h = heuristicEvaluation(ctx);
      const ai = await requestModuleEvaluation(ctx);
      const goalId = rm.modules.find((m) => m.id === moduleId)?.goalId ?? null;
      const payload = ai
        ? { summary: ai.summary, strengths: ai.strengths, gaps: ai.gaps, challenge: ai.challenge, score: h.score, source: "ai", provider: ai.provider }
        : { summary: h.summary, strengths: h.strengths, gaps: h.gaps, challenge: h.challenge, score: h.score, source: "heuristic", provider: null };
      await fire("module.evaluated", payload as unknown as Json, { goalId, moduleId });
    },
    createNote: async (refs: Refs, title: string, markdown: string): Promise<string> => {
      const noteId = newEventId();
      await fire("note.created", { note_id: noteId, title, markdown }, refs);
      return noteId;
    },
    updateNote: (noteId: string, title: string, markdown: string) =>
      fire("note.updated", { note_id: noteId, title, markdown }),
    // ── Roadmap canvas edits — all expressed as EXISTING events (log is truth) ──
    createModule: async (goalId: string, title: string): Promise<string> => {
      const moduleId = newEventId();
      await fire("module.upserted", { title, prereqs: [], kind: "core" }, { goalId, moduleId });
      return moduleId;
    },
    connectPrereq: (from: string, to: string) => fire("roadmap.edge.upserted", { from, to }),
    archiveNode: (ref: string) => fire("node.archived", { ref }),
    // ── Ascend a Canvas obligation into a real learning module (Fase 4). The
    // mastery graph is only ever touched by THIS deliberate gesture — never by the
    // scraper. The link (sourceObligationId) makes the agenda mark it promoted. ──
    ascendObligation: async (obligationId: string, title: string, goalId: string): Promise<string> => {
      const moduleId = newEventId();
      await fire(
        "module.upserted",
        { title, prereqs: [], kind: "core", sourceObligationId: obligationId },
        { goalId, moduleId },
      );
      return moduleId;
    },
    moveNode: (ref: string, x: number, y: number) =>
      fire("roadmap.node.moved", { ref, x: Math.round(x), y: Math.round(y) }),
    getEvents: () => store.getState().getEvents(),
    rebuild: () => store.getState().rebuild(Date.now()),
  };
}
