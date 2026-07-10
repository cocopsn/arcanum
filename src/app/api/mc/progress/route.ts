import { NextResponse, type NextRequest } from "next/server";
import { project } from "@/core/projector";
import { mcAuthorized, loadUserEvents, buildSnapshot } from "@/lib/mc-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mc/progress — token-gated (X-MC-Token). Reads the user's events via the service_role, folds
// them with the SAME pure project() the app uses, and returns ONLY derived progress (stats, counts, active
// modules, review queue, recent activity). Server-to-server only: MC must call this from its BACKEND so the
// token stays server-side — never from a browser. No secret, no raw event, ever leaves.
export async function GET(req: NextRequest) {
  try {
    if (!mcAuthorized(req.headers.get("x-mc-token"))) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
    const events = await loadUserEvents();
    if (events === null) {
      return NextResponse.json({ ok: false, error: "Backend no configurado." }, { status: 503 });
    }
    const rm = project(events);
    return NextResponse.json(buildSnapshot(rm, events, Date.now()));
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
