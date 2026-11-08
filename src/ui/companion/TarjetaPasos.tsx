// Tarjeta de pasos de un envío (design §14.1, captura 3, DC-21): muestra sólo los pasos que corrieron, con su tiempo.
// El plan del modelo es otra tarjeta («Siguientes pasos», en Mensaje.tsx). Sólo clases cmp-*.
"use client";

export interface PasoEjecutado {
  etiqueta: string;
  /** milisegundos medidos, si el paso los reporta */
  ms?: number;
}

export function TarjetaPasos({ pasos }: { pasos: PasoEjecutado[] }) {
  if (pasos.length === 0) return null;
  return (
    <div className="cmp-pasos" role="status">
      <ol className="cmp-pasos-lista">
        {pasos.map((p, i) => (
          <li key={i} className="cmp-pasos-item">
            <span className="cmp-pasos-etiqueta">{p.etiqueta}</span>
            {p.ms !== undefined && <span className="cmp-pasos-tiempo">{p.ms} ms</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
