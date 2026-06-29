"use client";

import { useArcanumStore, useArcanumSync } from "@/app/providers";
import { makeEvent, type EventType, type Json } from "@/core/event";
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
    rebuild: () => store.getState().rebuild(Date.now()),
  };
}
