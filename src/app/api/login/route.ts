import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, checkCredentials } from "@/lib/access";

export const runtime = "nodejs";

// POST { email, password } → validates against the fixed user + ARCANUM_ACCESS_PASSWORD (server
// env). On success sets an httpOnly session cookie. The password never reaches the client bundle.
export async function POST(req: NextRequest) {
  const token = gateToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "El acceso no está configurado (falta ARCANUM_ACCESS_PASSWORD)." }, { status: 503 });
  }
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkCredentials(email, password)) {
    return NextResponse.json({ ok: false, error: "Correo o clave incorrectos." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — single-user device
  });
  return res;
}
