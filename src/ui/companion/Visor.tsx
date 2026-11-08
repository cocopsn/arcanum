// Visor apilado del compañero (design §10, RF-R10, DC-11). Pantalla `visor` del mismo panel, apilada sobre la
// conversación (que queda montada con hidden). Muestra el pasaje completo con Markdown.tsx y «Volver a la conversación».
// NUNCA monta BookReader, TopicDetailSheet, SubjectMap ni BooksLibrary (todos escriben el resume al montarse). El enlace
// al Atlas lo arma enlaceAtlas (sólo palantir.com/docs). Sólo clases cmp-*.
"use client";
import { Markdown } from "./Markdown";
import { enlaceAtlas } from "@/lib/companion/citas";

export interface PasajeVisor {
  titulo: string;
  seccion: string;
  /** markdown del pasaje (sección de libro, ficha, enunciado o nota) */
  texto: string;
  /** clave del Atlas para el enlace externo, si es una cita del Atlas */
  atlasKey?: string;
}

export function Visor({ pasaje, onVolver }: { pasaje: PasajeVisor; onVolver: () => void }) {
  const urlAtlas = pasaje.atlasKey ? enlaceAtlas(pasaje.atlasKey) : null;
  return (
    <div className="cmp-visor">
      <div className="cmp-visor-encabezado">
        <button type="button" className="cmp-boton cmp-volver" onClick={onVolver}>
          Volver a la conversación
        </button>
        <h3 className="cmp-visor-titulo">{pasaje.titulo}</h3>
        {pasaje.seccion && <p className="cmp-visor-seccion">{pasaje.seccion}</p>}
      </div>
      <div className="cmp-visor-cuerpo">
        <Markdown texto={pasaje.texto} />
      </div>
      {urlAtlas && (
        <a className="cmp-enlace cmp-atlas-enlace" href={urlAtlas} target="_blank" rel="noopener noreferrer">
          Abrir en palantir.com/docs
        </a>
      )}
    </div>
  );
}
