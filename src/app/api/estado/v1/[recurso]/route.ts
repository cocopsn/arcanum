import { NextResponse, type NextRequest } from "next/server";
import { project } from "@/core/projector";
import { loadUserEvents, buildSnapshot } from "@/lib/mc-status";
import { autorizar, construir, RECURSOS, validar, type Recurso } from "@/lib/estado-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/estado/v1/{recurso} — contrato de estado v1 (Milla 12). JWT HS256 por par. Sin cuerpo en la bitácora. */
export async function GET(req: NextRequest, { params }: { params: { recurso: string } }) {
  const t0 = Date.now();
  const recurso = params.recurso as Recurso;
  const fin = (status: number, cuerpo: unknown, emisor: string | null) => {
    console.log(JSON.stringify({ estado_v1: "llamada", recurso: RECURSOS.includes(recurso) ? recurso : "desconocido", emisor, status, ms: Date.now() - t0 }));
    return NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });
  };
  if (!RECURSOS.includes(recurso)) return fin(404, { error: "no_existe" }, null);
  const a = autorizar(req.headers.get("authorization"));
  if (!a.ok) return fin(a.status, { error: a.status === 503 ? "no_configurado" : "no_autorizado" }, null);
  try {
    let snap = null;
    if (recurso === "salud" || recurso === "metricas") {
      const events = await loadUserEvents();
      snap = events === null ? null : buildSnapshot(project(events), events, Date.now());
    }
    const cuerpo = construir(recurso, snap);
    if (validar(recurso, cuerpo).length) return fin(500, { error: "respuesta_fuera_de_contrato" }, a.emisor);
    return fin(200, cuerpo, a.emisor);
  } catch {
    return fin(500, { error: "interno" }, a.emisor);
  }
}
