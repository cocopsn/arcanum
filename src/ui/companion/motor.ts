// Motor del compañero (design §14.1): arma las dependencias de la conversación (almacén, armarEntrada, consultar) a
// partir del sensor, la ubicación, el buscador, el límite y el transporte. Vive en el chunk companion-ui y carga lo
// pesado (índice, reservado, forge) de forma perezosa a través del Buscador. Mantiene a Conversacion.tsx sin acoplarse
// a la app: recibe todo inyectado.
import { Buscador } from "@/lib/companion/busqueda";
import { Limite } from "@/lib/companion/limite";
import { consultar, type ResultadoConsulta } from "@/lib/companion/consultar";
import { invocarCompanion } from "@/lib/companion/transporte";
import { getSupabase } from "@/sync/client";
import type { EntradaSolicitud, Fase, Pedido } from "@/lib/companion/tipos";

/** Un motor con el buscador y el límite compartidos por la sesión del panel. */
export class Motor {
  readonly buscador = new Buscador();
  readonly limite = new Limite();

  /** Precarga del mundo activo y de los chunks perezosos (§9.1). */
  precargar(spineActivo: string | null): void {
    // pedir forge en reposo también, para que dibujar/practicar funcionen sin red (§9.1)
    this.buscador.precargar(spineActivo, () => void this.buscador.forge());
  }

  /** Corre un envío (§14.1) con las guardas, el buscador, el límite y el transporte reales. */
  async consultar(entrada: EntradaSolicitud, signal: AbortSignal): Promise<ResultadoConsulta> {
    const nombresAlcance = this.buscador.indice.nombres;
    return consultar(entrada, {
      buscar: async (e) => ({
        pasajes: await this.buscador.buscarEHidratar(e.pregunta, nombresAlcance, {
          libroSha10: null,
          tituloMundo: e.ubicacion.mundo,
        }),
      }),
      enLinea: () => typeof navigator === "undefined" || navigator.onLine !== false,
      haySesion: async () => {
        try {
          const { data } = await getSupabase().auth.getSession();
          return !!data.session;
        } catch {
          return false;
        }
      },
      reservar: () => this.limite.reservar(),
      marcarLleno: () => this.limite.marcarLleno(),
      cargarReservado: () => this.buscador.reservado(),
      transporte: (context, s) => invocarCompanion(context, s),
      signal,
    });
  }
}

/** Arma una EntradaSolicitud mínima a partir de la pregunta y el pedido (la ubicación completa la pone CompanionRoot). */
export function entradaBase(pregunta: string, pedido: Pedido, fase: Fase, mundo: EntradaSolicitud["mundo"]): EntradaSolicitud {
  return {
    pregunta,
    pedido,
    nivelPista: 0,
    lenguaje: "javascript",
    historial: [],
    pasajes: [],
    notas: [],
    ubicacion: { mundo: mundo === "forge" ? "Engineering Forge" : "Inicio", superficie: "inicio", fase, faseFuente: "inferida", modosFalla: [], brechas: [], repasos: [], tiposSugeridos: [] },
    mundo,
    conversacion: null,
  };
}
