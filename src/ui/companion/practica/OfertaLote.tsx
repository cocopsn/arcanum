// Oferta de un lote de ejercicios generados (design §18.2, §18.3). Valida el lote en el Worker ANTES de ofrecerlo
// (validarLote, protección b); sólo si pasa muestra «Practicar». Al aceptar, monta Practica (protecciones c y h). El
// lote NUNCA entra a arcanum-exercises: alAprobar sólo anuncia, y los intentos irían a arcanum-companion. Vive en el
// chunk companion-practica junto a Practica, EditorPlano, lote.ts y guarda-solucion.ts.
"use client";
import { useEffect, useState } from "react";
import { Practica } from "./Practica";
import { validarLote, type LoteAceptado } from "@/lib/companion/lote";

type Estado = { fase: "validando" } | { fase: "ofrecer"; lote: LoteAceptado } | { fase: "practicar"; lote: LoteAceptado } | { fase: "rechazado"; motivo: string };

export function OfertaLote({ md, titulo, celdaId }: { md: string; titulo: string; celdaId: string | null }) {
  const [estado, setEstado] = useState<Estado>({ fase: "validando" });
  const [anuncio, setAnuncio] = useState("");

  useEffect(() => {
    let vivo = true;
    void validarLote(md).then((r) => {
      if (!vivo) return;
      setEstado(r.ok ? { fase: "ofrecer", lote: { md: r.md, banco: r.banco, practicables: r.practicables, etiquetas: r.etiquetas } } : { fase: "rechazado", motivo: r.motivo });
    });
    return () => {
      vivo = false;
    };
  }, [md]);

  if (estado.fase === "validando") return <p className="cmp-cargando">Validando los ejercicios…</p>;
  if (estado.fase === "rechazado") return <p className="cmp-lote-rechazado">{estado.motivo}</p>;

  if (estado.fase === "ofrecer") {
    return (
      <div className="cmp-lote-oferta" data-cmp-celda={celdaId ?? undefined}>
        <p className="cmp-lote-titulo">Generado por IA · {titulo}</p>
        <p className="cmp-lote-nota">{estado.lote.practicables.length} ejercicio(s) validado(s) en tu dispositivo.</p>
        <button type="button" className="cmp-boton" onClick={() => setEstado({ fase: "practicar", lote: estado.lote })}>
          Practicar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="cmp-sr" role="status" aria-live="polite">
        {anuncio}
      </div>
      <Practica lote={estado.lote} alAprobar={() => setAnuncio("Ejercicio aprobado")} />
    </>
  );
}
