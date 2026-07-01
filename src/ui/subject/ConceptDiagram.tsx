"use client";

import type { ReactNode } from "react";

// Visual abstractions of key concepts — hand-authored SVG, ZERO image-API cost (coherent with the
// project's "visuals without paid API" rule). Themed via the world's --accent / --text / --line.
// Matched by keyword to a cell title; NO match → null (the viewer shows nothing fake, honest).

const S = "var(--accent)";
const T = "var(--text)";
const L = "var(--line)";
const M = "var(--text-muted)";

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className="rounded-[var(--r-sm)] border border-line bg-surface p-3">
      <svg viewBox="0 0 320 180" className="block h-auto w-full" role="img" aria-label={label}>
        {children}
      </svg>
      <figcaption className="mt-1 text-center text-[10px] uppercase tracking-[0.18em] text-text-faint">{label}</figcaption>
    </figure>
  );
}

const node = (x: number, y: number, txt: string, r = 15) => (
  <g key={`${x}-${y}-${txt}`}>
    <circle cx={x} cy={y} r={r} fill="var(--surface-raised)" stroke={S} strokeWidth="1.5" />
    <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill={T}>{txt}</text>
  </g>
);
const edge = (x1: number, y1: number, x2: number, y2: number, dash = false) => (
  <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={L} strokeWidth="1.5" strokeDasharray={dash ? "4 3" : undefined} />
);

function Tree() {
  return (
    <Frame label="Árbol balanceado (AVL / BST)">
      {edge(160, 34, 90, 90)}{edge(160, 34, 230, 90)}
      {edge(90, 90, 50, 146)}{edge(90, 90, 130, 146)}{edge(230, 90, 190, 146)}{edge(230, 90, 270, 146)}
      {node(160, 34, "8")}{node(90, 90, "4")}{node(230, 90, "12")}
      {node(50, 146, "2")}{node(130, 146, "6")}{node(190, 146, "10")}{node(270, 146, "14")}
    </Frame>
  );
}
function Graph() {
  return (
    <Frame label="Grafo (nodos y aristas)">
      {edge(60, 50, 160, 40)}{edge(160, 40, 260, 60)}{edge(60, 50, 110, 130)}
      {edge(110, 130, 220, 140)}{edge(220, 140, 260, 60)}{edge(160, 40, 110, 130)}
      {node(60, 50, "A")}{node(160, 40, "B")}{node(260, 60, "C")}{node(110, 130, "D")}{node(220, 140, "E")}
    </Frame>
  );
}
function Heap() {
  return (
    <Frame label="Montículo (max-heap: padre ≥ hijos)">
      {edge(160, 34, 90, 90)}{edge(160, 34, 230, 90)}{edge(90, 90, 55, 146)}{edge(90, 90, 125, 146)}
      {node(160, 34, "50")}{node(90, 90, "30")}{node(230, 90, "40")}{node(55, 146, "10")}{node(125, 146, "20")}
    </Frame>
  );
}
function Hash() {
  const rows = [0, 1, 2, 3, 4];
  return (
    <Frame label="Tabla hash (buckets + encadenamiento)">
      {rows.map((i) => (
        <g key={i}>
          <rect x="24" y={20 + i * 30} width="34" height="24" fill="var(--surface-raised)" stroke={S} strokeWidth="1.2" />
          <text x="41" y={36 + i * 30} textAnchor="middle" fontSize="10" fill={M}>{i}</text>
          {(i === 1 || i === 3) && (
            <>
              <line x1="58" y1={32 + i * 30} x2="86" y2={32 + i * 30} stroke={L} strokeWidth="1.2" />
              <rect x="86" y={20 + i * 30} width="52" height="24" rx="3" fill="var(--surface-raised)" stroke={L} strokeWidth="1.2" />
              <text x="112" y={36 + i * 30} textAnchor="middle" fontSize="9" fill={T}>k→v</text>
            </>
          )}
        </g>
      ))}
    </Frame>
  );
}
function BigO() {
  return (
    <Frame label="Crecimiento asintótico">
      <line x1="30" y1="150" x2="300" y2="150" stroke={L} strokeWidth="1.2" />
      <line x1="30" y1="20" x2="30" y2="150" stroke={L} strokeWidth="1.2" />
      <path d="M30 150 L300 150" fill="none" stroke={M} strokeWidth="1.5" />
      <path d="M30 150 Q160 120 300 100" fill="none" stroke={S} strokeWidth="1.5" />
      <path d="M30 150 L300 40" fill="none" stroke={S} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M30 150 Q120 150 300 24" fill="none" stroke="var(--amber)" strokeWidth="1.5" />
      <text x="304" y="152" fontSize="9" fill={M}>O(1)</text>
      <text x="304" y="102" fontSize="9" fill={T}>O(log n)</text>
      <text x="270" y="36" fontSize="9" fill={T}>O(n)</text>
      <text x="250" y="22" fontSize="9" fill="var(--amber)">O(n²)</text>
    </Frame>
  );
}
function Pipeline() {
  const boxes = [
    { x: 8, t: "Sensor" },
    { x: 86, t: "MQTT" },
    { x: 164, t: "InfluxDB" },
    { x: 242, t: "Grafana" },
  ];
  return (
    <Frame label="Pipeline de datos (del sensor a la decisión)">
      {boxes.map((b, i) => (
        <g key={b.t}>
          <rect x={b.x} y="72" width="68" height="36" rx="4" fill="var(--surface-raised)" stroke={S} strokeWidth="1.4" />
          <text x={b.x + 34} y="94" textAnchor="middle" fontSize="10" fill={T}>{b.t}</text>
          {i < boxes.length - 1 && <line x1={b.x + 68} y1="90" x2={b.x + 78} y2="90" stroke={S} strokeWidth="1.6" markerEnd="url(#arr)" />}
        </g>
      ))}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={S} />
        </marker>
      </defs>
    </Frame>
  );
}

const MATCHERS: { re: RegExp; el: ReactNode; key: string }[] = [
  { re: /\bavl\b|árbol|arbol|balancead|\bbst\b|binari/i, el: <Tree />, key: "tree" },
  { re: /grafo|graph|dijkstra|\bbfs\b|\bdfs\b|shortest|camino/i, el: <Graph />, key: "graph" },
  { re: /heap|montículo|monticulo|prioridad/i, el: <Heap />, key: "heap" },
  { re: /hash|tabla|diccionario|mapa/i, el: <Hash />, key: "hash" },
  { re: /asintót|asintot|big-?o|complej|invariant|\bo\(/i, el: <BigO />, key: "bigo" },
  { re: /pipeline|mqtt|influx|grafana|sensor|datos industriales|opc[- ]?ua/i, el: <Pipeline />, key: "pipeline" },
];

/** The concept diagram for a cell title, or null if none matches (honest — no fake diagram). */
export function diagramFor(cellTitle: string): ReactNode | null {
  const hit = MATCHERS.find((m) => m.re.test(cellTitle));
  return hit ? hit.el : null;
}
