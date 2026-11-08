// Búsqueda del cliente cableada (design §9.1, §14.1): une el índice perezoso (indice.ts → CARGAR), el filtro reservado
// (reservado.ts → CARGAR_RESERVADO), el adaptador de Forge (forge.ts, chunk companion-forge) y la hidratación de
// pasajes. Es lo que Conversacion/Panel usan para armar la entrada y para que webpack emita los chunks companion-idx-*,
// companion-reservado y companion-forge (budget.mjs §8.6). La precarga del mundo activo corre en requestIdleCallback.
import { Indice, precargar } from "./indice";
import { cargarReservado } from "./reservado";
import { buscar, type ContextoBusqueda } from "./bm25";
import { hidratar } from "./pasajes";
import type { AdaptadorForge } from "./forge";
import type { PasajeCandidato } from "./tipos";

/** Carga el adaptador de Forge en el chunk companion-forge (§9.4). */
export function cargarForge(): Promise<AdaptadorForge> {
  return import(/* webpackChunkName: "companion-forge" */ "./forge").then((m) => m.adaptadorForge);
}

/** El buscador del compañero: un índice perezoso y la hidratación de los resultados. */
export class Buscador {
  readonly indice = new Indice();
  private forgeP: Promise<AdaptadorForge> | null = null;

  /** Carga el adaptador de Forge una vez (memoizado). */
  forge(): Promise<AdaptadorForge> {
    this.forgeP ??= cargarForge();
    return this.forgeP;
  }

  /** Precarga del mundo activo y de los chunks de diagrama/pdf/práctica (§9.1). */
  precargar(spineActivo: string | null, pedirChunks?: () => void): void {
    precargar(this.indice, spineActivo, pedirChunks);
  }

  /** Carga el filtro reservado (chunk companion-reservado) cuando la solicitud tiene algo de Forge (§12.7). */
  reservado() {
    return cargarReservado();
  }

  /** Busca sobre las particiones cargadas y las que el alcance pida, hidrata y aplica los filtros de §9.5. */
  async buscarEHidratar(consulta: string, nombresAlcance: string[], ctx: ContextoBusqueda, diagnosticoVisible?: (code: string) => boolean): Promise<PasajeCandidato[]> {
    await this.indice.cargarVarias(nombresAlcance);
    const resultados = buscar(this.indice.listas, consulta, ctx);
    const forge = await this.forge();
    return hidratar(resultados, { forge, diagnosticoVisible });
  }
}
