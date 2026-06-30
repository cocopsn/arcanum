import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → { authed, configured }. authed when the cookie matches the server token. When the env var
// is NOT set (e.g. local dev), configured=false → the client treats the gate as open (no lock).
export async function GET(req: NextRequest) {
  const token = gateToken();
  const cookie = req.cookies.get(GATE_COOKIE)?.value ?? null;
  return NextResponse.json({ authed: !!token && cookie === token, configured: !!token });
}
