"use client";

import { useEffect, useRef } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { getSupabase } from "@/sync/client";

// Drains the offline AI queue when the network + a session come back. Runs on mount, on the browser
// 'online'/'focus' events, and on an interval. Single-flight (a ref) so a burst of triggers can't
// double-send. It calls the REAL evaluator per pending — no heuristic, no fake — and if the evaluator
// is still unreachable it leaves the items queued (honest). Renders nothing.
export function AiQueueDrain() {
  const pendingCount = useArcanum((s) => s.readModel.pendingAi.length);
  const { drainAiQueue } = useActions();
  const draining = useRef(false);

  useEffect(() => {
    async function drain() {
      if (draining.current || pendingCount === 0) return;
      // the Edge evaluator needs a live Supabase session — without it, stay queued (don't spin)
      try {
        const {
          data: { session },
        } = await getSupabase().auth.getSession();
        if (!session) return;
      } catch {
        return;
      }
      draining.current = true;
      try {
        await drainAiQueue();
      } finally {
        draining.current = false;
      }
    }
    void drain();
    const trigger = () => void drain();
    window.addEventListener("online", trigger);
    window.addEventListener("focus", trigger);
    const interval = window.setInterval(trigger, 60_000);
    return () => {
      window.removeEventListener("online", trigger);
      window.removeEventListener("focus", trigger);
      window.clearInterval(interval);
    };
  }, [pendingCount, drainAiQueue]);

  return null;
}
