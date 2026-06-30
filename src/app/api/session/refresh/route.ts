import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, ACCESS_EMAIL, gateToken } from "@/lib/access";
import { ensureSupabaseSession } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST → mint the single user's Supabase session, REUSING the gate cookie as the authorization (no
// password typed). This is what lets sync SELF-HEAL when the env-gate login predated the service_role
// being configured: the client calls this and adopts the returned session. There is NO manual Supabase
// login anymore — the managed password is a server secret, so the gate cookie IS the proof of identity.
// Honest failure modes (never throw, never fake a session):
//  - gate not configured (dev/open)      → { ok:false, reason:"unconfigured" } (200; nothing to mint)
//  - gate cookie missing/invalid          → 401 (must be past the lock first)
//  - service_role absent / Supabase error → { ok:false, reason:"no-service-role" } (200; stays local)
export async function POST(req: NextRequest) {
  const token = gateToken();
  if (!token) return NextResponse.json({ ok: false, reason: "unconfigured" });
  const cookie = req.cookies.get(GATE_COOKIE)?.value ?? null;
  if (cookie !== token) {
    return NextResponse.json({ ok: false, reason: "not-authed" }, { status: 401 });
  }
  let supabase = null;
  try {
    supabase = await ensureSupabaseSession(ACCESS_EMAIL);
  } catch {
    supabase = null;
  }
  return supabase
    ? NextResponse.json({ ok: true, supabase })
    : NextResponse.json({ ok: false, reason: "no-service-role" });
}
