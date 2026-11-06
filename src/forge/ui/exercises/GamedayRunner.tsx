"use client";

import type { RunnerProps } from "./registry";
import { PENDING_TEXT } from "@/forge/ui/flow-contract";

// STUB (Phase 0) of the `gameday` runner. Owner: forge/e3-ia, which replaces this file (design §9.5, §22.4). It grades
// nothing and offers no verdict: it only says, honestly, that the type is not available yet.
export default function GamedayRunner({ item }: RunnerProps) {
  return (
    <p role="status" data-forge-stub="gameday" data-item={item.itemId}>
      {PENDING_TEXT}
    </p>
  );
}
