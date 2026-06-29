"use client";

import { useArcanumStore, useArcanumSync } from "@/app/providers";
import { makeEvent, newEventId, type EventType, type Json } from "@/core/event";
import { getDeviceId } from "@/lib/device";

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
