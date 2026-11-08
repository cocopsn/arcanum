// Sensor de sólo lectura (design §12.1, CA-20). Arma un DOM de prueba y comprueba que el sensor nunca deja salir el
// texto de un campo (ExitGate) y que un flujo de ontología da superficie mision. El red-check de .value sobre el
// fuente vive en fuentes-seguras.test.ts; aquí el de comportamiento con un sensor de prueba que copia .value.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sensar } from "../sensor";

// loadResume se lee del store real; lo fijamos a un resume con una celda abierta.
vi.mock("@/lib/resume", () => ({
  loadResume: () => ({ v: 1, world: "g1", cell: "cell-1", bookId: null, library: false, ts: 0 }),
  saveResume: () => undefined,
  clearResume: () => undefined,
}));

const FRASE = "ESTA-FRASE-SECRETA-NO-DEBE-SALIR-DEL-COMPONENTE";

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.dataset.world = "forge";
});
afterEach(() => {
  document.body.innerHTML = "";
  delete document.body.dataset.world;
});

/** Monta una ficha de Forge con un ExitGate: un textarea cuyo value es la frase marcadora. */
function montarCompuerta(flow: string) {
  document.body.innerHTML = `
    <div role="dialog" aria-labelledby="topic-title" data-forge-cell-panel="F0-01">
      <h2 id="topic-title">Ontología de la plataforma</h2>
      <div data-forge-flow="${flow}">
        <section data-forge-flow="${flow}">
          <textarea aria-label="Tu justificación de primer principio"></textarea>
        </section>
      </div>
    </div>`;
  const ta = document.querySelector("textarea")!;
  (ta as HTMLTextAreaElement).value = FRASE;
}

describe("sensor sin value (§12.1)", () => {
  it("una compuerta de ontología no deja salir el value del campo, ni en el sensado ni en su JSON", () => {
    montarCompuerta("ontologia");
    const s = sensar(document);
    expect(JSON.stringify(s)).not.toContain(FRASE);
    expect(s.tituloDialogo).not.toContain(FRASE);
  });

  it("un flujo de ontología da superficie mision (fila 4 de §12.3)", () => {
    montarCompuerta("ontologia");
    const s = sensar(document);
    expect(s.superficie).toBe("mision");
    expect(s.tipoItem).toBe("ontologia");
  });

  it("lee el título del h2 con textContent y el código de la celda", () => {
    montarCompuerta("ontologia");
    const s = sensar(document);
    expect(s.tituloDialogo).toBe("Ontología de la plataforma");
    expect(s.codigoForge).toBe("F0-01");
  });
});

describe("red-check de comportamiento (§12.1)", () => {
  it("un sensor de prueba que copia .value sí deja salir la frase → «el compañero leyó lo que escribes en una compuerta»", () => {
    montarCompuerta("ontologia");
    // sensor de prueba con la protección quitada: además copia el value del textarea
    const sensorRoto = (doc: Document) => {
      const base = sensar(doc);
      const ta = doc.querySelector("textarea") as HTMLTextAreaElement | null;
      return { ...base, fuga: ta?.value ?? null };
    };
    const s = sensorRoto(document);
    const fuga = JSON.stringify(s).includes(FRASE);
    expect(fuga, "el compañero leyó lo que escribes en una compuerta").toBe(true); // el sensor roto SÍ filtra (demostración del rojo)
    // control: el sensor real no filtra
    expect(JSON.stringify(sensar(document))).not.toContain(FRASE);
  });
});
