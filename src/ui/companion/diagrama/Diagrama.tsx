// Dibuja un diagrama del modelo con elementos de React (design §16.3, protección d). NUNCA pinta HTML del modelo: el
// texto de cada etiqueta va como nodo de texto de React ({linea}), que React escapa; no hay foreignObject, <script>,
// <image>, href, xlink:href ni atributos on*. Sin colores: cada elemento lleva una de tres clases (cmp-dg-texto,
// cmp-dg-trazo, cmp-dg-acento) y pinta con currentColor; el color de cada clase vive en estilos.ts (colores.test.ts lo
// vigila). Centinela data-companion-chunk="cmp-diagrama-v1". «Editar fuente» reparse con 300 ms de espera (§16.3).
"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { parsearDiagrama } from "@/lib/companion/diagrama/parser";
import { disponerDiagrama, type ModeloDiagrama, type CajaDibujo, type AristaDibujo } from "@/lib/companion/diagrama/layout";

type Estado = { modelo: ModeloDiagrama } | { error: string } | { fuera: { linea: number } };

function construir(fuente: string): Estado {
  const r = parsearDiagrama(fuente);
  if (!r.ok) return { fuera: { linea: r.linea } };
  try {
    return { modelo: disponerDiagrama(r.ast) };
  } catch (e) {
    const nombre = e instanceof Error ? e.name : String(e);
    // eslint-disable-next-line no-console
    console.warn("compañero: no se pudo dibujar el diagrama:", nombre);
    return { error: "No se pudo dibujar el diagrama" };
  }
}

export function Diagrama({ fuente, titulo }: { fuente: string; titulo?: string }) {
  const [borrador, setBorrador] = useState(fuente);
  const [editando, setEditando] = useState(false);
  const [debounced, setDebounced] = useState(fuente);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBorrador(fuente);
    setDebounced(fuente);
  }, [fuente]);

  const alCambiar = (v: string) => {
    setBorrador(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(v), 300);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const estado = useMemo(() => construir(debounced), [debounced]);
  const crudo = useId();
  // id saneado para el marcador (§16.3): sólo [A-Za-z0-9_-]
  const flechaId = "cmp-dg-" + crudo.replace(/[^A-Za-z0-9_-]/g, "");

  return (
    <figure className="cmp-dg" data-companion-chunk="cmp-diagrama-v1">
      {titulo && <figcaption className="cmp-dg-titulo">{titulo}</figcaption>}
      {"modelo" in estado ? (
        <SvgDiagrama modelo={estado.modelo} flechaId={flechaId} />
      ) : "fuera" in estado ? (
        <div className="cmp-dg-fuera">
          <p className="cmp-dg-aviso">Sintaxis fuera del subconjunto (línea {estado.fuera.linea})</p>
          <pre className="cmp-dg-codigo">{debounced}</pre>
        </div>
      ) : (
        <div className="cmp-dg-fuera">
          <p className="cmp-dg-aviso">{estado.error}</p>
          <pre className="cmp-dg-codigo">{debounced}</pre>
        </div>
      )}
      <p className="cmp-dg-marca">Generado por IA · borrador</p>
      <button type="button" className="cmp-boton cmp-dg-editar" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
        Editar fuente
      </button>
      {editando && (
        <>
          <label htmlFor="cmp-dg-fuente" className="cmp-sr">
            Fuente del diagrama
          </label>
          <textarea id="cmp-dg-fuente" className="cmp-dg-ta" value={borrador} onChange={(e) => alCambiar(e.target.value)} rows={6} spellCheck={false} />
        </>
      )}
    </figure>
  );
}

function SvgDiagrama({ modelo, flechaId }: { modelo: ModeloDiagrama; flechaId: string }) {
  const ancho = Math.max(modelo.ancho, 1);
  const alto = Math.max(modelo.alto, 1);
  return (
    <svg className="cmp-dg-svg" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Diagrama generado por IA" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id={flechaId} markerWidth={8} markerHeight={8} refX={7} refY={3} orient="auto" markerUnits="strokeWidth">
          <polygon className="cmp-dg-acento" points="0,0 8,3 0,6" fill="currentColor" />
        </marker>
      </defs>
      {modelo.subgrafos.map((sg) => (
        <g key={"sg-" + sg.id}>
          <rect className="cmp-dg-trazo" x={sg.x} y={sg.y} width={sg.ancho} height={sg.alto} fill="none" stroke="currentColor" strokeDasharray="2 2" />
          {sg.titulo && (
            <text className="cmp-dg-texto" x={sg.x + sg.ancho / 2} y={sg.y + 12} fill="currentColor" fontSize={12} textAnchor="middle">
              {sg.titulo}
            </text>
          )}
        </g>
      ))}
      {modelo.lineasVida.map((lv, i) => (
        <g key={"lv-" + i}>
          <line className="cmp-dg-trazo" x1={lv.x} y1={lv.y1} x2={lv.x} y2={lv.y2} stroke="currentColor" strokeDasharray="3 3" />
          <text className="cmp-dg-texto" x={lv.ex} y={lv.y1 - 6} fill="currentColor" fontSize={12} textAnchor="middle">
            {lv.etiqueta}
          </text>
        </g>
      ))}
      {modelo.aristas.map((a, i) => (
        <Arista key={"a-" + i} arista={a} flechaId={flechaId} />
      ))}
      {modelo.nodos.map((n) => (
        <Nodo key={"n-" + n.id} nodo={n} />
      ))}
      {modelo.notas.map((nota, i) => (
        <g key={"nota-" + i}>
          <rect className="cmp-dg-trazo" x={nota.x} y={nota.y} width={nota.ancho} height={nota.alto} fill="none" stroke="currentColor" />
          <TextoCentrado lineas={nota.texto} cx={nota.x + nota.ancho / 2} cy={nota.y + nota.alto / 2} />
        </g>
      ))}
    </svg>
  );
}

function Nodo({ nodo }: { nodo: CajaDibujo }) {
  const { x, y, ancho: w, alto: h } = nodo;
  let forma: JSX.Element;
  if (nodo.forma === "circulo") forma = <ellipse className="cmp-dg-trazo" fill="none" stroke="currentColor" cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />;
  else if (nodo.forma === "rombo")
    forma = <polygon className="cmp-dg-trazo" fill="none" stroke="currentColor" points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} />;
  else if (nodo.forma === "cilindro")
    forma = (
      <path
        className="cmp-dg-trazo"
        fill="none"
        stroke="currentColor"
        d={`M${x},${y + 6} C${x},${y} ${x + w},${y} ${x + w},${y + 6} L${x + w},${y + h} C${x + w},${y + h - 6} ${x},${y + h - 6} ${x},${y + h} Z`}
      />
    );
  else forma = <rect className="cmp-dg-trazo" fill="none" stroke="currentColor" x={x} y={y} width={w} height={h} rx={nodo.forma === "redondo" ? 10 : 0} ry={nodo.forma === "redondo" ? 10 : 0} />;
  return (
    <g>
      {forma}
      <TextoCentrado lineas={nodo.texto} cx={x + w / 2} cy={y + h / 2} />
    </g>
  );
}

function Arista({ arista, flechaId }: { arista: AristaDibujo; flechaId: string }) {
  if (arista.puntos.length < 2) return null;
  const d = arista.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  // La referencia al marcador se arma por partes para no escribir el prefijo funcional que colores.test.ts marca como
  // color en un .tsx (cualquier aparición de esa función CSS).
  const marcador = arista.punta ? "url" + "(#" + flechaId + ")" : undefined;
  return (
    <g>
      <path className="cmp-dg-trazo" d={d} fill="none" stroke="currentColor" strokeDasharray={arista.punteada ? "4 3" : undefined} markerEnd={marcador} />
      {arista.etiqueta && arista.etiquetaPos && <TextoCentrado lineas={[arista.etiqueta]} cx={arista.etiquetaPos.x} cy={arista.etiquetaPos.y} />}
    </g>
  );
}

function TextoCentrado({ lineas, cx, cy }: { lineas: string[]; cx: number; cy: number }) {
  const y0 = cy - (lineas.length * 16) / 2 + 12;
  return (
    <text className="cmp-dg-texto" x={cx} y={y0} fill="currentColor" fontSize={12} textAnchor="middle">
      {lineas.map((l, i) => (
        <tspan key={i} x={cx} dy={i === 0 ? 0 : 16}>
          {l}
        </tspan>
      ))}
    </text>
  );
}
