import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SyncClient } from "@/sync/sync";
import type { EventRow } from "@/sync/mapping";

let _client: SupabaseClient | null = null;

/** Browser Supabase client (anon/publishable key). Singleton. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _client;
}

/** Adapt supabase-js to the injectable SyncClient surface. */
export function makeSyncClient(sb: SupabaseClient): SyncClient {
  return {
    async upsertEvents(rows: EventRow[]) {
      const { error } = await sb
        .from("events")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      return { error };
    },
    async fetchSince(cursor: number) {
      const { data, error } = await sb
        .from("events")
        .select("*")
        .gt("seq", cursor)
        .order("seq", { ascending: true });
      return { data: (data ?? []) as EventRow[], error };
    },
  };
}
