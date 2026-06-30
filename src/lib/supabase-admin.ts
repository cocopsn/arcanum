import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// SERVER-ONLY. After the env-var gate validates the single user, this provisions their Supabase
// session so ONE login gives both the gate AND cloud sync + the real AI (which need a Supabase
// session). The Supabase user's password is a SERVER-MANAGED secret derived from the service_role
// (never the access password, never seen by the client). Import ONLY from route handlers.
// If the service_role is not configured, returns null → the gate still works, sync/AI just stay off.

function managedPassword(service: string): string {
  return createHash("sha256").update("arcanum:sbpw:v1:" + service).digest("hex");
}

export interface SupabaseSessionTokens {
  access_token: string;
  refresh_token: string;
}

export async function ensureSupabaseSession(email: string): Promise<SupabaseSessionTokens | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anon) return null; // not configured → gate works, sync/AI just off (honest)

  const password = managedPassword(service);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // provision the single user (idempotent): create already-confirmed, or set the managed password
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) await admin.auth.admin.updateUserById(existing.id, { password });
  }

  // mint a session as that user (anon client) → return tokens for the client to adopt
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}
