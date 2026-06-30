import type { SupabaseClient, User } from "@supabase/supabase-js";

// signIn stays for the gated live integration test (RUN_SUPABASE_IT). The APP no longer logs into
// Supabase with a typed password — the env-gate mints the session server-side (see /api/login +
// /api/session/refresh). There is no signUp: it's a single, server-provisioned user (no self-registration).
export function signIn(sb: SupabaseClient, email: string, password: string) {
  return sb.auth.signInWithPassword({ email, password });
}

export function signOut(sb: SupabaseClient) {
  return sb.auth.signOut();
}

export async function currentUser(sb: SupabaseClient): Promise<User | null> {
  const { data } = await sb.auth.getUser();
  return data.user;
}

/** Subscribe to auth changes; returns an unsubscribe fn. */
export function onAuthChange(
  sb: SupabaseClient,
  cb: (user: User | null) => void,
): () => void {
  const { data } = sb.auth.onAuthStateChange((_event, session) =>
    cb(session?.user ?? null),
  );
  return () => data.subscription.unsubscribe();
}
