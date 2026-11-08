// Ubicación pedagógica (design §12.2, §12.4). armarUbicacion es pura: mapea el sensado, el read model y el view model
// a la Ubicacion que viaja (§12.5). Las piezas propias de Forge (estado/competencia/código, remediación, autoría) las
// calcula forge.ts y llegan en `extrasForge`; lo demás (mundo, masteryPct, modosFalla, últimoVeredicto, brechas,
// repasos, tiposSugeridos) se deriva aquí del rm/vm. No toca el DOM ni la red.
import type { ReadModel } from "@/core/read-model";
import type { ViewModel } from "@/core/present";
import type { ForgeFailureMode } from "@/core/forge-verdict";
import type { CompetenceState } from "@/forge/model/competence";
import type { Sensado } from "@/ui/companion/sensor";
import type { EstadoCelda, TipoEjercicio, Ubicacion } from "./tipos";

/** Las piezas que sólo Forge calcula (via forge.ts), ya resueltas (§12.2). */
export interface ExtrasForge {
  codigo?: string;
  estado?: EstadoCelda;
  competencia?: CompetenceState | "desconocido";
  remediacion?: { modo: ForgeFailureMode; diagnostico: string; intervencion: string };
  autoria?: NonNullable<NonNullable<Ubicacion["celda"]>["autoria"]>;
}

/** Práctica generada local de esta celda (de arcanum-companion), si la hay. */
export interface PracticaLocal {
  aprobados: number;
  intentados: number;
}

/** Traducción de nodeStatus (roadmap.ts) al estado del compañero (§12.2). */
const ESTADO_NODO: Record<string, EstadoCelda> = { sealed: "sellada", available: "disponible", started: "en_curso", completed: "dominada" };
/** Traducción de forgeCellState (console-stats.ts) al estado del compañero (§12.2). */
const ESTADO_FORGE: Record<string, EstadoCelda> = { sellado: "sellada", disponible: "disponible", "en-curso": "en_curso", dominado: "dominada", observado: "observada", reprobado: "reprobada" };

/** tiposSugeridos por modo de falla (§12.4); sin modo, `code` por omisión (o production+mc en Alemán). */
const TIPOS_POR_MODO: Record<ForgeFailureMode, TipoEjercicio[]> = {
  concepto: ["multiple_choice", "production"],
  ejecucion: ["code"],
  patron: ["multiple_choice"],
  tutorial: ["code"],
  defensa: ["production"],
  happy_path: ["code"],
  priorizacion: ["production"],
  olvido: ["multiple_choice"],
};

/** Estado de una celda: Forge (extrasForge) o nodeStatus traducido. */
function estadoDe(extras: ExtrasForge | undefined, nodeStatus: string | undefined): EstadoCelda {
  if (extras?.estado) return extras.estado;
  if (extras?.codigo && nodeStatus === undefined) return "desconocido";
  const key = nodeStatus ?? "";
  return ESTADO_FORGE[key] ?? ESTADO_NODO[key] ?? "desconocido";
}

/** tiposSugeridos (§12.4): por el modo de remediación; sin modo, `code` (o production+mc si es Alemán). */
export function tiposSugeridos(modo: ForgeFailureMode | undefined, esAleman: boolean): TipoEjercicio[] {
  if (modo) return TIPOS_POR_MODO[modo];
  return esAleman ? ["production", "multiple_choice"] : ["code"];
}

/** Lo que armarUbicacion recibe además del sensado/rm/vm. */
export interface DepsUbicacion {
  extrasForge?: ExtrasForge;
  practicaLocal?: PracticaLocal;
  /** nodeStatus de la celda (cinco mundos), ya calculado por el llamador con roadmap.ts */
  nodeStatus?: string;
  /** título del goal activo (mundo) */
  tituloMundo?: string;
}

/** Arma la ubicación (§12.2). Pura. */
export function armarUbicacion(sensado: Sensado, rm: ReadModel, vm: ViewModel, deps: DepsUbicacion = {}): Ubicacion {
  const cellId = sensado.resume?.cell ?? null;
  const extras = deps.extrasForge;
  const mundo = deps.tituloMundo ?? "Inicio";
  const esAleman = /alem/i.test(mundo);

  // modosFalla: los dos últimos failureMode no nulos de los veredictos Forge de la celda.
  const modosFalla: ForgeFailureMode[] = cellId
    ? rm.forgeVerdicts
        .filter((v) => v.moduleId === cellId && v.failureMode !== null)
        .slice(-2)
        .map((v) => v.failureMode as ForgeFailureMode)
    : [];

  // últimoVeredicto: el GateRM de la celda.
  const gate = cellId ? rm.gates.find((g) => g.moduleId === cellId) : undefined;
  const ultimoVeredicto = gate ? { aprobado: gate.passed, resumen: gate.summary } : undefined;

  // brechas: hasta 3 gaps de la última evaluación de la celda.
  const evalRM = cellId ? rm.evaluations.find((e) => e.moduleId === cellId) : undefined;
  const brechas = (evalRM?.gaps ?? []).filter((g) => g.trim() !== "").slice(0, 3);

  // repasos: hasta 3 títulos de vm.reviewQueue, resueltos a su título por rm.modules.
  const tituloModulo = new Map(rm.modules.map((m) => [m.id, m.title]));
  const repasos = vm.reviewQueue
    .map((r) => tituloModulo.get(r.moduleId) ?? "")
    .filter((t) => t.trim() !== "")
    .slice(0, 3);

  // masteryPct: round(retrievability × 100) de vm.modules.
  const mv = cellId ? vm.modules.find((m) => m.id === cellId) : undefined;
  const masteryPct = mv ? Math.round(mv.retrievability * 100) : undefined;

  const modo = extras?.remediacion?.modo;
  const ubicacion: Ubicacion = {
    mundo,
    superficie: sensado.superficie,
    fase: "general", // la fija consultar/CompanionRoot con inferirFase; aquí sólo la ubicación base
    faseFuente: "inferida",
    modosFalla,
    brechas,
    repasos,
    tiposSugeridos: tiposSugeridos(modo, esAleman),
  };
  if (ultimoVeredicto) ubicacion.ultimoVeredicto = ultimoVeredicto;
  if (extras?.remediacion) ubicacion.remediacion = extras.remediacion;

  // celda
  if (cellId && (sensado.tituloDialogo || extras?.codigo)) {
    const rmModule = rm.modules.find((m) => m.id === cellId);
    ubicacion.celda = {
      titulo: sensado.tituloDialogo ?? rmModule?.title ?? cellId,
      estado: estadoDe(extras, deps.nodeStatus),
      ...(extras?.codigo ? { codigo: extras.codigo } : {}),
      ...(extras?.competencia ? { competencia: extras.competencia } : {}),
      ...(masteryPct !== undefined ? { masteryPct } : {}),
      ...(extras?.autoria ? { autoria: extras.autoria } : {}),
    };
  }

  // libro
  if (sensado.superficie === "libro" && sensado.libroEtiqueta) {
    ubicacion.libro = { titulo: sensado.libroEtiqueta };
  }

  // ejercicio
  if (sensado.superficie === "ejercicios" && sensado.tituloDialogo) {
    ubicacion.ejercicio = { titulo: sensado.tituloDialogo, tipo: sensado.tipoItem ?? "code" };
  }

  if (deps.practicaLocal) ubicacion.practicaGenerada = deps.practicaLocal;
  return ubicacion;
}
