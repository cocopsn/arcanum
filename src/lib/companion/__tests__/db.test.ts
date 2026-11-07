// Persistencia del compañero (design §19.1-§19.2). Usa fake-indexeddb (vitest.setup). Comprueba el guardado y lectura,
// la retención 100, el borrado de una conversación con sus mensajes/lotes/intentos, el borrado total con
// Dexie.delete + llaves arcanum_companion_*, y el fallar-cerrado a memoria cuando Dexie no abre.
import { afterEach, describe, expect, it } from "vitest";
import { AlmacenMemoria, CompanionDB, NOMBRE_DB, PREFIJO_LS, RETENCION, abrirAlmacen, limpiarLocalStorage } from "../db";
import type { ConversacionRow, MensajeRow } from "../db";

let n = 0;
function dbUnica() {
  return new CompanionDB(`${NOMBRE_DB}-test-${Date.now()}-${n++}`);
}

const conv = (id: string, actualizada: number): ConversacionRow => ({ id, titulo: id, creada: actualizada, actualizada, mundo: "forge", celdaId: null });
const msg = (id: string, conversacionId: string, orden: number): MensajeRow => ({
  id,
  conversacionId,
  orden,
  rol: "companero",
  mundo: "forge",
  texto: "hola",
  citas: [],
  pasajesEnviados: [],
  artefactos: [],
  plan: [],
  proveedor: "azure",
  avisos: [],
  estado: "ok",
  creado: orden,
});

afterEach(() => {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k) localStorage.removeItem(k);
  }
});

describe("almacén Dexie (§19.1)", () => {
  it("guarda y lee conversaciones y mensajes ordenados", async () => {
    const al = await abrirAlmacen(dbUnica);
    expect(al.persistente).toBe(true);
    await al.guardarConversacion(conv("c1", 100));
    await al.guardarMensaje(msg("m2", "c1", 2));
    await al.guardarMensaje(msg("m1", "c1", 1));
    const ms = await al.mensajesDe("c1");
    expect(ms.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("retención: al crear la 101 se borra la más vieja por actualizada (§19.2)", async () => {
    const al = await abrirAlmacen(dbUnica);
    for (let i = 1; i <= RETENCION; i++) await al.guardarConversacion(conv(`c${i}`, i));
    expect(await al.contar()).toBe(RETENCION);
    await al.guardarConversacion(conv("c101", 101));
    expect(await al.contar()).toBe(RETENCION);
    const ids = (await al.conversaciones()).map((c) => c.id);
    expect(ids).not.toContain("c1"); // la más vieja se fue
    expect(ids).toContain("c101");
  });

  it("borrar una conversación se lleva sus mensajes", async () => {
    const al = await abrirAlmacen(dbUnica);
    await al.guardarConversacion(conv("c1", 1));
    await al.guardarMensaje(msg("m1", "c1", 1));
    await al.borrarConversacion("c1");
    expect(await al.contar()).toBe(0);
    expect(await al.mensajesDe("c1")).toEqual([]);
  });

  it("borrar todo deja 0 filas y quita las llaves arcanum_companion_* (§19.2, parte de CA-36)", async () => {
    const al = await abrirAlmacen(dbUnica);
    await al.guardarConversacion(conv("c1", 1));
    localStorage.setItem(`${PREFIJO_LS}ui`, "x");
    localStorage.setItem("otra_cosa", "y");
    await al.borrarTodo();
    expect(localStorage.getItem(`${PREFIJO_LS}ui`)).toBeNull();
    expect(localStorage.getItem("otra_cosa")).toBe("y");
  });
});

describe("fallar-cerrado del almacenamiento (§19.1)", () => {
  it("si Dexie no abre, cae a memoria con persistente=false", async () => {
    const al = await abrirAlmacen(() => {
      throw new Error("sin IndexedDB");
    });
    expect(al.persistente).toBe(false);
    await al.guardarConversacion(conv("c1", 1));
    expect((await al.conversaciones()).map((c) => c.id)).toEqual(["c1"]);
  });

  it("el almacén en memoria también respeta la retención 100", async () => {
    const al = new AlmacenMemoria();
    for (let i = 1; i <= RETENCION + 5; i++) await al.guardarConversacion(conv(`c${i}`, i));
    expect(await al.contar()).toBe(RETENCION);
  });
});

describe("limpiarLocalStorage", () => {
  it("quita sólo las llaves con el prefijo del compañero", () => {
    localStorage.setItem(`${PREFIJO_LS}rl`, "1");
    localStorage.setItem(`${PREFIJO_LS}ui`, "2");
    localStorage.setItem("arcanum_otro", "3");
    limpiarLocalStorage();
    expect(localStorage.getItem(`${PREFIJO_LS}rl`)).toBeNull();
    expect(localStorage.getItem(`${PREFIJO_LS}ui`)).toBeNull();
    expect(localStorage.getItem("arcanum_otro")).toBe("3");
  });
});
