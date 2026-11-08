// Tipos y límites compartidos del Compañero (design §12.2, §12.5, §13.2, §13.4). Los números de LIMITES son los
// mismos que COMP_LIMITES de la Edge (supabase/functions/ai-router/index.ts); contrato-edge.test.ts los compara.
// Sólo tipos y constantes: este módulo no importa nada en tiempo de ejecución.
import type { ForgeFailureMode } from "@/core/forge-verdict";
import type { CompetenceState } from "@/forge/model/competence";

/** Techos de cada campo de la solicitud (§12.5 = COMP_LIMITES de §13.2). El cliente recorta antes; la Edge rechaza. */
export const LIMITES = {
  contexto: 60_000,
  pregunta: 2_000,
  historial: { max: 6, texto: 1_500 },
  pasajes: { max: 8, titulo: 200, seccion: 200, texto: 1_500 },
  notas: { max: 3, titulo: 120, texto: 600 },
  ubicacion: {
    mundo: 80,
    celdaTitulo: 200,
    libroTitulo: 200,
    libroSeccion: 200,
    ejercicioTitulo: 200,
    diagnostico: 300,
    intervencion: 300,
    resumen: 300,
    brechas: { max: 3, texto: 200 },
    repasos: { max: 3, texto: 200 },
    modosFalla: 2,
    tiposSugeridos: 3,
    porcentaje: 100,
    entero: 999, // masteryPct usa porcentaje; pendientes, fallidos, aprobados e intentados usan entero
  },
} as const;

export type Limites = typeof LIMITES;

/** Regla única de recorte con «…» (§12.5, r3b #10): el resultado mide `max` con la elipsis incluida. */
export const recortar = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// Enumeraciones del cliente: los mismos valores que las COMP_* de la Edge (§13.2).
export const FASES = ["predecir", "comprender", "completar", "construir", "contrastar", "transferir", "retener", "general"] as const;
export const FUENTES_FASE = ["inferida", "elegida"] as const;
export const SUPERFICIES = [
  "inicio",
  "mundo",
  "celda",
  "libro",
  "lecturas",
  "ejercicios",
  "leccion",
  "compuerta",
  "mision",
  "practica_forge",
  "notas",
  "atlas",
  "desconocido",
] as const;
export const ESTADOS_CELDA = ["sellada", "disponible", "en_curso", "dominada", "observada", "reprobada", "desconocido"] as const;
export const COMPETENCIAS = ["no_evaluada", "en_aprendizaje", "con_apoyo", "independiente", "retenida", "desconocido"] as const;
export const PEDIDOS = ["explicar", "pista", "diagrama", "ejercicios", "plan", "libre"] as const;
export const TIPOS_PASAJE = ["libro", "ficha", "ejercicio", "nota", "atlas"] as const;
export const TIPOS_EJERCICIO = ["code", "multiple_choice", "production"] as const;
export const VERIFICACIONES = ["vigente", "desactualizada", "sin-registro"] as const;
export const LENGUAJES = ["javascript", "python"] as const;
export const ROLES_TURNO = ["aprendiz", "companero"] as const;
/** Valores de `data-cmp-mundo` (§7). */
export const MUNDOS_CMP = ["forge", "inicio", "mundo"] as const;

export type Fase = (typeof FASES)[number];
export type FuenteFase = (typeof FUENTES_FASE)[number];
export type Superficie = (typeof SUPERFICIES)[number];
export type EstadoCelda = (typeof ESTADOS_CELDA)[number];
export type Competencia = (typeof COMPETENCIAS)[number];
export type Pedido = (typeof PEDIDOS)[number];
export type TipoPasaje = (typeof TIPOS_PASAJE)[number];
export type TipoEjercicio = (typeof TIPOS_EJERCICIO)[number];
export type Verificacion = (typeof VERIFICACIONES)[number];
export type Lenguaje = (typeof LENGUAJES)[number];
export type RolTurno = (typeof ROLES_TURNO)[number];
export type MundoCmp = (typeof MUNDOS_CMP)[number];

/** Ubicación pedagógica del aprendiz (§12.2). */
export interface Ubicacion {
  /** título del goal o «Inicio» */
  mundo: string;
  superficie: Superficie;
  fase: Fase;
  faseFuente: FuenteFase;
  celda?: {
    titulo: string;
    /** código sólo en Forge */
    codigo?: string;
    estado: EstadoCelda;
    competencia?: CompetenceState | "desconocido";
    /** round(retrievability × 100) */
    masteryPct?: number;
    autoria?: {
      libroPublicado: boolean;
      bancoEnDispositivo: boolean;
      pendientes: number;
      verificacion: Verificacion;
      fallidos: number;
    };
  };
  libro?: { titulo: string; seccion?: string };
  ejercicio?: { titulo: string; tipo: string };
  remediacion?: { modo: ForgeFailureMode; diagnostico: string; intervencion: string };
  /** los dos últimos failureMode no nulos de la celda */
  modosFalla: ForgeFailureMode[];
  ultimoVeredicto?: { aprobado: boolean; resumen: string };
  brechas: string[];
  repasos: string[];
  tiposSugeridos: TipoEjercicio[];
  practicaGenerada?: { aprobados: number; intentados: number };
}

/** Un turno del historial tal como viaja (§12.5). */
export interface TurnoContexto {
  rol: RolTurno;
  texto: string;
}

/** Un pasaje tal como viaja a la Edge (§13.2). */
export interface PasajeContexto {
  id: string; // P1…P8
  tipo: TipoPasaje;
  titulo: string;
  seccion: string;
  texto: string;
}

export interface NotaContexto {
  titulo: string;
  texto: string;
}

/** El cuerpo `context` de la acción `companion` (§12.5, §13.2). */
export interface CompanionContext {
  pregunta: string;
  pedido: Pedido;
  nivelPista: number; // 0-3
  lenguaje: Lenguaje;
  historial: TurnoContexto[];
  pasajes: PasajeContexto[];
  notas: NotaContexto[];
  ubicacion: Ubicacion;
}

/** Artefacto devuelto por el modelo (§13.4). */
export type Artefacto = { tipo: "diagrama"; titulo: string; fuente: string } | { tipo: "ejercicios"; titulo: string; md: string };

/** Paso del plan devuelto por el modelo (§13.4). */
export interface PasoPlan {
  titulo: string;
  detalle: string;
}

/** Respuesta de la Edge, ya parseada (§13.4). */
export interface CompanionReply {
  respuesta: string;
  citas: string[];
  artefactos: Artefacto[];
  plan: PasoPlan[];
  avisos: string[];
}

/** Pasaje guardado con el mensaje para resolver citas después de recargar (§10). */
export interface PasajeEnviado {
  /** P1…P8 */
  id: string;
  /** llave local del documento (partición y ancla, o la nota) */
  clave: string;
  tipo: TipoPasaje;
  titulo: string;
  seccion: string;
  /** a dónde lleva el visor (§10) */
  destino: string;
  /** esPasajeForge(p) al enviarse (§12.5) */
  forge: boolean;
}

/** Un pasaje candidato antes de armar la solicitud (§9.4, §9.5). */
export interface PasajeCandidato {
  clave: string;
  tipo: TipoPasaje;
  titulo: string;
  seccion: string;
  texto: string;
  puntaje: number;
  /** partición del MANIFIESTO de la que salió, si salió del índice */
  particion?: string;
  /** adjuntado con el clip */
  adjunto?: boolean;
  /** nota de una celda de Forge */
  notaForge?: boolean;
}

/** Un turno de la conversación en curso, como lo guarda el panel (§12.5). */
export interface TurnoEntrada {
  rol: RolTurno;
  texto: string;
  estado: "ok" | "error" | "cancelado";
}

/** Lo que `armarSolicitud` recibe (§12.5): lo que se manda más la conversación completa para `tieneForge`. */
export interface EntradaSolicitud {
  pregunta: string;
  pedido: Pedido;
  nivelPista: number;
  lenguaje: Lenguaje;
  historial: TurnoEntrada[];
  pasajes: PasajeCandidato[];
  notas: NotaContexto[];
  ubicacion: Ubicacion;
  /** mundo activo (data-cmp-mundo) */
  mundo: MundoCmp;
  conversacion: { mundo: MundoCmp; mensajes: { mundo?: MundoCmp; pasajesEnviados: { forge: boolean }[] }[] } | null;
}
