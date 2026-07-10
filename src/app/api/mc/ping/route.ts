import { NextResponse, type NextRequest } from "next/server";
import { mcAuthorized, mcConfigured, MC_API_VERSION } from "@/lib/mc-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mc/ping — token-gated liveness for MC (the Vigía). No DB fold — cheap heartbeat. `configured`
// tells MC whether /api/mc/progress can serve live data (token + service_role both present).
export async function GET(req: NextRequest) {
  if (!mcAuthorized(req.headers.get("x-mc-token"))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "arcanum", ts: Date.now(), apiVersion: MC_API_VERSION, configured: mcConfigured() });
}
