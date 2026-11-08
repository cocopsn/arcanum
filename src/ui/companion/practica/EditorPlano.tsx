// Editor de práctica del compañero (design §18.5, protección h). Usa react-simple-code-editor con resaltado PLANO: el
// `highlight` devuelve NODOS de React ({code}), que React escapa, así que la firma hostil del modelo y lo que el
// aprendiz teclee NUNCA se interpretan como HTML (la librería sólo pinta con dangerouslySetInnerHTML cuando highlight
// devuelve una cadena). Sin Prism. El nombre accesible va en el <textarea> por textareaId, no en el <div> exterior
// (r3 #7). La clase del textarea es cmp-editor-ta (no code-editor-ta): el sensor no debe confundirlo con ExerciseMode.
"use client";
import Editor from "react-simple-code-editor";
import type { ReactNode } from "react";
import type { Lang } from "@/lib/exercise";

const plano = (code: string): ReactNode => <>{code}<br /></>; // nodos de React: React escapa el texto

export function EditorPlano({ valor, alCambiar, lang }: { valor: string; alCambiar: (v: string) => void; lang: Lang }) {
  return (
    <>
      <label htmlFor="cmp-editor-practica" className="cmp-sr">
        Editor de práctica
      </label>
      <Editor
        value={valor}
        onValueChange={alCambiar}
        highlight={plano}
        tabSize={lang === "python" ? 4 : 2}
        insertSpaces
        padding={12}
        textareaClassName="cmp-editor-ta"
        textareaId="cmp-editor-practica"
        style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13, lineHeight: 1.55 }}
      />
    </>
  );
}
