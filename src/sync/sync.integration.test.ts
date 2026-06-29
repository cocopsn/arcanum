import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { makeSyncClient, getSupabase } from "@/sync/client";
import { signIn } from "@/sync/auth";
import { createDb } from "@/db/schema";
import { appendEvent, getAllEvents } from "@/db/repo";
import { push, pull } from "@/sync/sync";
import { makeEvent, newEventId } from "@/core/event";

// Live round-trip against the real Supabase project. Gated: only runs with
// RUN_SUPABASE_IT=1 and a signed-in test user (migration 0001 applied).
const RUN = process.env.RUN_SUPABASE_IT === "1";

describe.skipIf(!RUN)("Supabase live integration", () => {
  let sb: SupabaseClient;

  beforeAll(async () => {
    sb = getSupabase();
    const email = process.env.TEST_EMAIL ?? "";
    const password = process.env.TEST_PASSWORD ?? "";
    const { error } = await signIn(sb, email, password);
    if (error) throw new Error(`sign-in failed: ${error.message}`);
  });

  it("round-trips an event push → pull across two local stores", async () => {
    const id = newEventId();
    const dbA = createDb(`it-a-${id}`);
    await appendEvent(dbA, makeEvent("error.resolved", { insight: id }, { ts: Date.now(), deviceId: "it", id }));
    expect(await push(dbA, makeSyncClient(sb))).toBe(1);

    const dbB = createDb(`it-b-${id}`);
    await pull(dbB, makeSyncClient(sb));
    expect((await getAllEvents(dbB)).some((e) => e.id === id)).toBe(true);

    await dbA.delete();
    await dbB.delete();
  });

  it("rejects update/delete (append-only RLS — no policy)", async () => {
    const id = newEventId();
    const dbA = createDb(`it-c-${id}`);
    await appendEvent(dbA, makeEvent("error.resolved", { insight: id }, { ts: Date.now(), deviceId: "it", id }));
    await push(dbA, makeSyncClient(sb));

    // No update policy → the row matches nothing the policy allows mutating.
    await sb.from("events").update({ device_id: "tampered" }).eq("id", id);
    const { data } = await sb.from("events").select("device_id").eq("id", id).single();
    expect(data?.device_id).toBe("it"); // unchanged

    await dbA.delete();
    // Best-effort cleanup with the service role (append-only blocks anon delete).
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (svc && url) {
      await createClient(url, svc).from("events").delete().eq("id", id);
    }
  });
});
