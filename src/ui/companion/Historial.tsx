// Historial de conversaciones (design §19.1-§19.2). Lista las conversaciones guardadas, abre una y ofrece borrar una o
// todo el compañero. El borrado lo hace el almacén (db.ts); nada del log. Sólo clases cmp-*.
"use client";
import type { ConversacionRow } from "@/lib/companion/db";

export function Historial({
  conversaciones,
  onAbrir,
  onBorrar,
  onBorrarTodo,
}: {
  conversaciones: ConversacionRow[];
  onAbrir: (id: string) => void;
  onBorrar: (id: string) => void;
  onBorrarTodo: () => void;
}) {
  return (
    <div className="cmp-historial">
      {conversaciones.length === 0 ? (
        <p className="cmp-historial-vacio">Todavía no hay conversaciones.</p>
      ) : (
        <ul className="cmp-historial-lista">
          {conversaciones.map((c) => (
            <li key={c.id} className="cmp-historial-item">
              <button type="button" className="cmp-historial-abrir" onClick={() => onAbrir(c.id)}>
                {c.titulo}
              </button>
              <button type="button" className="cmp-boton cmp-borrar" aria-label={`Borrar ${c.titulo}`} onClick={() => onBorrar(c.id)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="cmp-boton cmp-borrar-todo" onClick={onBorrarTodo}>
        Borrar todo el compañero
      </button>
    </div>
  );
}
