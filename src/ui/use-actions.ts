"use client";

import { useArcanumStore, useArcanumSync } from "@/app/providers";
import { makeEvent, newEventId, type EventType, type Json } from "@/core/event";
import { getDeviceId } from "@/lib/device";
import { buildEvaluationContext, heuristicEvaluation } from "@/core/evaluation";
import { buildGateContext } from "@/lib/gate";
import { buildInterrogationContext } from "@/lib/mission";
import { buildLessonContext, buildLessonGradeContext } from "@/lib/lesson";
import {
  requestModuleEvaluation,
  requestGateEvaluation,
  requestInterrogation,
  requestLessonSteps,
  requestLessonGrade,
  type LessonCourseReply,
  type LessonGrade,
} from "@/sync/ai";

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
    // The adversarial EXIT GATE (WHITE ROOM): grade the learner's justification against
    // the cell rubric. ONLY a real AI pass opens the gate → unseals the next cell (real power).
    // OFFLINE / no evaluator reachable → ENQUEUE the justification honestly (ai.queued): the gate does
    // NOT open by enqueuing; the real verdict on reconnect decides. Records gate.evaluated (auditable).
    evaluateGate: async (moduleId: string, justification: string): Promise<void> => {
      const rm = store.getState().readModel;
      const ctx = buildGateContext(rm, moduleId, justification);
      if (!ctx) return;
      const goalId = rm.modules.find((m) => m.id === moduleId)?.goalId ?? null;
      const ai = await requestGateEvaluation(ctx);
      if (ai) {
        await fire("gate.evaluated", { passed: ai.passed, score: ai.score, summary: ai.summary, feedback: ai.feedback, source: "ai", provider: ai.provider }, { goalId, moduleId });
      } else {
        await fire("ai.queued", { queueId: newEventId(), kind: "gate", input: { justification } }, { goalId, moduleId });
      }
    },
    // ── DIRECTED MISSION loop (heavy cells) ──────────────────────────────────────
    // The learner returns from the assigned source and submits EVIDENCE (their notes).
    // mission.submitted is durable proof of work in the log, independent of any verdict.
    submitMission: (refs: Refs, notes: string) => fire("mission.submitted", { notes }, refs),
    // The INTERROGATION (the mission's gate): the Asuka interrogator generates pointed questions
    // against the mission's REAL content and judges the submitted evidence. ONLY a real pass opens
    // the next node. OFFLINE → ENQUEUE the evidence (ai.queued); the interrogation runs for real on
    // reconnect. The gate never opens from the enqueue. The evidence is also durable in mission.submitted.
    interrogateMission: async (moduleId: string, notes: string): Promise<void> => {
      const rm = store.getState().readModel;
      const ctx = buildInterrogationContext(rm, moduleId, notes);
      if (!ctx) return;
      const goalId = rm.modules.find((m) => m.id === moduleId)?.goalId ?? null;
      const ai = await requestInterrogation(ctx);
      if (ai) {
        await fire("gate.evaluated", { passed: ai.passed, score: ai.score, summary: ai.summary, feedback: ai.feedback, questions: ai.questions, source: "ai", provider: ai.provider }, { goalId, moduleId });
      } else {
        await fire("ai.queued", { queueId: newEventId(), kind: "mission", input: { notes } }, { goalId, moduleId });
      }
    },
    // Drain the offline AI queue on reconnect — send each pending to the REAL evaluator and let its
    // verdict (gate.evaluated with the matching queueId) resolve it. NO heuristic, NO fake: if the
    // evaluator is still unreachable, stop and leave the item queued for the next attempt. Idempotent
    // (a duplicate verdict is harmless — gatePassed is monotonic, resolution is keyed by queueId).
    drainAiQueue: async (): Promise<number> => {
      const rm = store.getState().readModel;
      let resolved = 0;
      for (const p of rm.pendingAi) {
        const goalId = rm.modules.find((m) => m.id === p.moduleId)?.goalId ?? null;
        const input = (p.input ?? {}) as { justification?: string; notes?: string };
        if (p.kind === "gate") {
          const ctx = buildGateContext(rm, p.moduleId, input.justification ?? "");
          if (!ctx) continue;
          const ai = await requestGateEvaluation(ctx);
          if (!ai) break;
          await fire("gate.evaluated", { passed: ai.passed, score: ai.score, summary: ai.summary, feedback: ai.feedback, source: "ai", provider: ai.provider, queueId: p.queueId }, { goalId, moduleId: p.moduleId });
        } else {
          const ctx = buildInterrogationContext(rm, p.moduleId, input.notes ?? "");
          if (!ctx) continue;
          const ai = await requestInterrogation(ctx);
          if (!ai) break;
          await fire("gate.evaluated", { passed: ai.passed, score: ai.score, summary: ai.summary, feedback: ai.feedback, questions: ai.questions, source: "ai", provider: ai.provider, queueId: p.queueId }, { goalId, moduleId: p.moduleId });
        }
        resolved++;
      }
      return resolved;
    },
    // ── Capa B — the step-by-step LIGHT lesson (full-screen mode) ────────────────
    // generate the whole course (concept + N micro-challenges) against the cell's REAL source.
    // Returns null without AI (no invented lesson — honest; the real source still works).
    generateLessonCourse: async (moduleId: string, angleIndex = 0): Promise<LessonCourseReply | null> => {
      const rm = store.getState().readModel;
      const ctx = buildLessonContext(rm, moduleId, angleIndex);
      if (!ctx) return null;
      return requestLessonSteps(ctx);
    },
    // grade ONE step's answer FAIRLY. Pure read — fires NO event; the RUN drives the log:
    // a resolved correction → error.resolved (resolveError), the whole lesson cleared →
    // checkpoint.passed (passLesson). null without AI / parse-fail → the run can't advance on
    // garbage (no placebo reinforcement). Anti-gaming (empty/trivial → not understood) is the grader's.
    gradeLessonStep: async (
      cellTitle: string,
      challenge: string,
      rubric: string[],
      answer: string,
    ): Promise<LessonGrade | null> => {
      const ctx = buildLessonGradeContext(cellTitle, challenge, rubric, answer);
      return requestLessonGrade(ctx);
    },
    // the WHOLE lesson cleared → ONE checkpoint.passed. score = the run's MEASURED understanding
    // (avg of the steps' grades), never a constant — the reinforcement matches what was shown.
    passLesson: (refs: Refs, score: number) =>
      fire("checkpoint.passed", { score, kind: "checkpoint" }, refs),
    createNote: async (refs: Refs, title: string, markdown: string): Promise<string> => {
      const noteId = newEventId();
      await fire("note.created", { note_id: noteId, title, markdown }, refs);
      return noteId;
    },
    updateNote: (noteId: string, title: string, markdown: string) =>
      fire("note.updated", { note_id: noteId, title, markdown }),
    // Re-anchor a note to a cell/module (or null to detach). Carries the current title+markdown so the
    // single note.updated event is self-contained; the projector applies the anchor (no new event type).
    anchorNote: async (noteId: string, moduleId: string | null): Promise<void> => {
      const n = store.getState().readModel.notes.find((x) => x.id === noteId);
      if (!n) return;
      await fire("note.updated", { note_id: noteId, title: n.title, markdown: n.markdown, moduleId });
    },
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
