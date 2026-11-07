// Persistencia del compañero (design §19.1-§19.2). Base Dexie separada «arcanum-companion», nunca sincronizada ni
// subida: conversaciones, mensajes, lotes e intentos. Retención 100 (al crear la 101 se borra la más vieja por
// `actualizada`). «Borrar esta conversación» y «Borrar todo el compañero» (Dexie.delete + llaves arcanum_companion_*).
// Si Dexie no abre o lanza QuotaExceededError, la conversación vive en memoria con aviso. Date.now() está bien aquí
// (no es el pliegue del log). El único evento que entra al log (note.created) lo escribe GuardarNota.tsx, no este
// módulo.
import Dexie, { type Table } from "dexie";
import type { Artefacto, PasajeEnviado, PasoPlan, RolTurno, MundoCmp } from "./tipos";

/** Retención de conversaciones (§19.2). */
export const RETENCION = 100;
/** Nombre de la base y prefijo de llaves de localStorage del compañero (§19.2). */
export const NOMBRE_DB = "arcanum-companion";
export const PREFIJO_LS = "arcanum_companion_";

export interface ConversacionRow {
  id: string;
  titulo: string;
  creada: number;
  actualizada: number;
  mundo: MundoCmp;
  celdaId: string | null;
}

export interface MensajeRow {
  id: string;
  conversacionId: string;
  orden: number;
  rol: RolTurno;
  /** el data-cmp-mundo activo al enviar el turno (§10, §19.1) */
  mundo: MundoCmp;
  texto: string;
  textoEditado?: string;
  citas: string[];
  pasajesEnviados: PasajeEnviado[];
  artefactos: Artefacto[];
  plan: PasoPlan[];
  proveedor: string;
  avisos: string[];
  estado: "ok" | "error" | "cancelado";
  creado: number;
}

export interface LoteRow {
  id: string;
  conversacionId: string;
  mensajeId: string;
  celdaId: string | null;
  md: string;
  estado: "aceptado" | "rechazado";
  motivo?: string;
  ejercicios: unknown[];
  creado: number;
}

export interface IntentoRow {
  id: string;
  loteId: string;
  ejercicioId: string;
  resultado: unknown;
  creado: number;
}

/** La base Dexie del compañero (§19.1). */
export class CompanionDB extends Dexie {
  conversaciones!: Table<ConversacionRow, string>;
  mensajes!: Table<MensajeRow, string>;
  lotes!: Table<LoteRow, string>;
  intentos!: Table<IntentoRow, string>;

  constructor(name = NOMBRE_DB) {
    super(name);
    this.version(1).stores({
      conversaciones: "id, actualizada",
      mensajes: "id, conversacionId, [conversacionId+orden]",
      lotes: "id, conversacionId, celdaId",
      intentos: "id, loteId",
    });
  }
}

/** Lo que la UI usa; una implementación sobre Dexie y otra en memoria (fallar-cerrado del almacenamiento). */
export interface AlmacenCompanero {
  /** true si el historial persiste; false si vive sólo en memoria (y la UI pinta el aviso de §19.1) */
  readonly persistente: boolean;
  guardarConversacion(c: ConversacionRow): Promise<void>;
  guardarMensaje(m: MensajeRow): Promise<void>;
  conversaciones(): Promise<ConversacionRow[]>;
  mensajesDe(conversacionId: string): Promise<MensajeRow[]>;
  borrarConversacion(id: string): Promise<void>;
  borrarTodo(): Promise<void>;
  /** cantidad de conversaciones (para las pruebas de retención y borrado) */
  contar(): Promise<number>;
}

/** Quita toda llave de localStorage que empiece con arcanum_companion_ (§19.2). */
export function limpiarLocalStorage(ls: Storage | undefined = typeof localStorage !== "undefined" ? localStorage : undefined): void {
  if (!ls) return;
  const llaves: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(PREFIJO_LS)) llaves.push(k);
  }
  for (const k of llaves) ls.removeItem(k);
}

/** Almacén sobre Dexie. Aplica la retención 100 al guardar una conversación nueva. */
class AlmacenDexie implements AlmacenCompanero {
  readonly persistente = true;
  constructor(private readonly db: CompanionDB) {}

  async guardarConversacion(c: ConversacionRow): Promise<void> {
    const existe = await this.db.conversaciones.get(c.id);
    await this.db.conversaciones.put(c);
    if (!existe) await this.podar();
  }

  /** Al pasar de RETENCION conversaciones, borra las más viejas por `actualizada` con sus mensajes, lotes e intentos. */
  private async podar(): Promise<void> {
    const n = await this.db.conversaciones.count();
    if (n <= RETENCION) return;
    const viejas = await this.db.conversaciones.orderBy("actualizada").limit(n - RETENCION).toArray();
    for (const v of viejas) await this.borrarConversacion(v.id);
  }

  async guardarMensaje(m: MensajeRow): Promise<void> {
    await this.db.mensajes.put(m);
    await this.db.conversaciones.update(m.conversacionId, { actualizada: m.creado });
  }

  conversaciones(): Promise<ConversacionRow[]> {
    return this.db.conversaciones.orderBy("actualizada").reverse().toArray();
  }

  mensajesDe(conversacionId: string): Promise<MensajeRow[]> {
    return this.db.mensajes.where("[conversacionId+orden]").between([conversacionId, Dexie.minKey], [conversacionId, Dexie.maxKey]).toArray();
  }

  async borrarConversacion(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.conversaciones, this.db.mensajes, this.db.lotes, this.db.intentos, async () => {
      const lotes = await this.db.lotes.where("conversacionId").equals(id).primaryKeys();
      for (const loteId of lotes) await this.db.intentos.where("loteId").equals(loteId).delete();
      await this.db.lotes.where("conversacionId").equals(id).delete();
      await this.db.mensajes.where("conversacionId").equals(id).delete();
      await this.db.conversaciones.delete(id);
    });
  }

  async borrarTodo(): Promise<void> {
    this.db.close();
    await Dexie.delete(NOMBRE_DB);
    limpiarLocalStorage();
  }

  contar(): Promise<number> {
    return this.db.conversaciones.count();
  }
}

/** Almacén en memoria (§19.1): la conversación vive mientras la pestaña esté abierta. */
export class AlmacenMemoria implements AlmacenCompanero {
  readonly persistente = false;
  private convs = new Map<string, ConversacionRow>();
  private msgs = new Map<string, MensajeRow>();

  async guardarConversacion(c: ConversacionRow): Promise<void> {
    const nueva = !this.convs.has(c.id);
    this.convs.set(c.id, c);
    if (nueva && this.convs.size > RETENCION) {
      const viejas = [...this.convs.values()].sort((a, b) => a.actualizada - b.actualizada).slice(0, this.convs.size - RETENCION);
      for (const v of viejas) await this.borrarConversacion(v.id);
    }
  }

  async guardarMensaje(m: MensajeRow): Promise<void> {
    this.msgs.set(m.id, m);
    const c = this.convs.get(m.conversacionId);
    if (c) c.actualizada = m.creado;
  }

  async conversaciones(): Promise<ConversacionRow[]> {
    return [...this.convs.values()].sort((a, b) => b.actualizada - a.actualizada);
  }

  async mensajesDe(conversacionId: string): Promise<MensajeRow[]> {
    return [...this.msgs.values()].filter((m) => m.conversacionId === conversacionId).sort((a, b) => a.orden - b.orden);
  }

  async borrarConversacion(id: string): Promise<void> {
    this.convs.delete(id);
    for (const [k, m] of this.msgs) if (m.conversacionId === id) this.msgs.delete(k);
  }

  async borrarTodo(): Promise<void> {
    this.convs.clear();
    this.msgs.clear();
    limpiarLocalStorage();
  }

  async contar(): Promise<number> {
    return this.convs.size;
  }
}

/**
 * Abre el almacén del compañero (§19.1). Intenta Dexie; si no abre (o lanza), cae al almacén en memoria con un
 * `console.warn` y `persistente: false`, para que la UI pinte «No se puede guardar el historial en este dispositivo…».
 * `crearDb` es inyectable para las pruebas (fake-indexeddb o un doble que lanza).
 */
export async function abrirAlmacen(crearDb: () => CompanionDB = () => new CompanionDB()): Promise<AlmacenCompanero> {
  try {
    const db = crearDb();
    await db.open();
    return new AlmacenDexie(db);
  } catch (e) {
    console.warn(`[companion] historial sólo en memoria: ${e instanceof Error ? e.name : "error"}`);
    return new AlmacenMemoria();
  }
}
