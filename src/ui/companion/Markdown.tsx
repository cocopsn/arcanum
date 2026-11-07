// Render seguro del markdown del modelo (design §15). Envuelve ReactMarkdown con remark-gfm y SIN rehype-raw (el HTML
// del modelo queda como texto), con urlTransform={transformarUrl} (sólo https: y #cita-P[1-8]) y el plugin
// notasSinIds. Nunca pinta <img> (queda «[imagen: alt]»), los enlaces https: abren en pestaña nueva con
// rel="noopener noreferrer", las citas #cita-Pn se vuelven botón sólo si Pn está en la tabla del mensaje, y el código
// va en <pre><code> monocromo de texto plano con «copiar». Sólo clases cmp-* (colores.test.ts, regla 5).
"use client";
import { useCallback, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { transformarUrl, CITA_RE } from "./markdown-urls";
import { notasSinIds } from "./markdown-notas";

export interface MarkdownProps {
  /** el markdown ya redactado (§12.7) */
  texto: string;
  /** ids de cita válidos del mensaje (los que están en pasajesEnviados); fuera de ella, el enlace queda como texto */
  citasValidas?: ReadonlySet<string>;
  /** al tocar una cita válida; el visor abre el pasaje (§10) */
  alAbrirCita?: (id: string) => void;
}

/** Texto plano de los hijos de un nodo, para el botón de copiar y el «[imagen: alt]». */
function textoDe(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textoDe).join("");
  if (typeof children === "object" && "props" in (children as { props?: { children?: ReactNode } })) {
    return textoDe((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export function Markdown({ texto, citasValidas, alAbrirCita }: MarkdownProps) {
  const copiar = useCallback((t: string) => {
    void navigator.clipboard?.writeText(t);
  }, []);

  const components: Components = {
    a({ href, children }) {
      const h = typeof href === "string" ? href : "";
      if (CITA_RE.test(h)) {
        const id = h.slice("#cita-".length); // P1…P8
        if (citasValidas?.has(id)) {
          return (
            <button type="button" className="cmp-cita" onClick={() => alAbrirCita?.(id)}>
              {children}
            </button>
          );
        }
        return <span className="cmp-cita-rota">{children}</span>;
      }
      if (/^https:\/\//i.test(h)) {
        return (
          <a className="cmp-enlace" href={h} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      // urlTransform ya vació cualquier otro protocolo; se pinta el texto del enlace, nunca la URL.
      return <span className="cmp-enlace-inerte">{children}</span>;
    },
    img({ alt }) {
      // Nunca un <img>: ninguna petición sale por una imagen del modelo (CA-28).
      return <span className="cmp-imagen">[imagen: {typeof alt === "string" ? alt : ""}]</span>;
    },
    pre({ children }) {
      const codigo = textoDe(children);
      return (
        <div className="cmp-pre-caja">
          <pre className="cmp-pre">{children}</pre>
          <button type="button" className="cmp-copiar" onClick={() => copiar(codigo)}>
            copiar
          </button>
        </div>
      );
    },
    code({ children }) {
      // Texto plano monocromo; sin prism-react-renderer ni clase language-* (§15: sólo lectura, no resaltado).
      return <code className="cmp-codigo">{children}</code>;
    },
    table({ children }) {
      return (
        <div className="cmp-tabla-caja">
          <table className="cmp-tabla">{children}</table>
        </div>
      );
    },
  };

  return (
    <div className="cmp-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[notasSinIds]}
        urlTransform={transformarUrl}
        remarkRehypeOptions={{ footnoteLabel: "Notas", footnoteBackLabel: "Volver a la referencia" }}
        components={components}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
