// Artefactos de un mensaje del compañero (design §16, §18). Carga en perezoso el chunk companion-diagrama (Diagrama) y
// companion-practica (Practica) sólo cuando el mensaje trae un artefacto de ese tipo, así el budget los exige sin que
// entren a companion-ui. Un diagrama se dibuja inline; un lote de ejercicios se OFRECE (validarLote en companion-practica)
// y, al aceptar, se practica sin tocar la maestría (protección c/h). Nunca se pinta HTML del modelo.
"use client";
import { Suspense, lazy, useState } from "react";
import type { Artefacto } from "@/lib/companion/tipos";

// Chunk companion-diagrama (parser, layout, svg-texto, exportar y el dibujo).
const Diagrama = lazy(() =>
  import(/* webpackChunkName: "companion-diagrama" */ "./diagrama/Diagrama").then((m) => ({ default: m.Diagrama })),
);
// Chunk companion-practica (Practica, EditorPlano, lote y guarda-solucion).
const OfertaLote = lazy(() =>
  import(/* webpackChunkName: "companion-practica" */ "./practica/OfertaLote").then((m) => ({ default: m.OfertaLote })),
);

export function Artefactos({ artefactos, celdaId }: { artefactos: Artefacto[]; celdaId?: string | null }) {
  if (artefactos.length === 0) return null;
  return (
    <div className="cmp-artefactos">
      {artefactos.map((a, i) =>
        a.tipo === "diagrama" ? (
          <Suspense key={i} fallback={<p className="cmp-cargando">Dibujando el diagrama…</p>}>
            <Diagrama fuente={a.fuente} titulo={a.titulo} />
          </Suspense>
        ) : (
          <Suspense key={i} fallback={<p className="cmp-cargando">Preparando la práctica…</p>}>
            <OfertaLote md={a.md} titulo={a.titulo} celdaId={celdaId ?? null} />
          </Suspense>
        ),
      )}
    </div>
  );
}

/** Acción «Exportar a PDF» de una respuesta: carga el chunk companion-pdf sólo al pulsarla (design §17.3). */
export function BotonPdf({ respuesta, titulo, citas }: { respuesta: string; titulo: string; citas: { titulo: string; seccion: string }[] }) {
  const [estado, setEstado] = useState<"idle" | "generando" | "error">("idle");
  const exportar = async () => {
    setEstado("generando");
    try {
      const { generarPdf } = await import(/* webpackChunkName: "companion-pdf" */ "@/lib/companion/pdf/escritor");
      const { descargar, nombreArtefacto } = await import("@/lib/companion/descarga");
      const bytes = generarPdf([{ markdown: respuesta, diagramas: [], citas }], { titulo, fecha: new Date() });
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      await descargar(blob, nombreArtefacto("arcanum-respuesta", "pdf"));
      setEstado("idle");
    } catch {
      setEstado("error");
    }
  };
  return (
    <button type="button" className="cmp-boton cmp-exportar-pdf" onClick={() => void exportar()} disabled={estado === "generando"}>
      {estado === "generando" ? "Generando PDF…" : estado === "error" ? "No se pudo generar el PDF" : "Exportar a PDF"}
    </button>
  );
}
