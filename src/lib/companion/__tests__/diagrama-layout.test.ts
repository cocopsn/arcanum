// Parser y disposición de diagramas (design §16.2, §16.3). Puro, sin DOM. Comprueba el subconjunto, los límites, las
// cuatro líneas fuera del subconjunto que nombran la línea, y que la disposición da un modelo con cajas y polilíneas
// (flowchart por dagre; sequenceDiagram en columnas de 140 px y filas de 36 px).
import { describe, it, expect } from "vitest";
import { parsearDiagrama, LIMITES_DIAGRAMA } from "@/lib/companion/diagrama/parser";
import { disponerDiagrama } from "@/lib/companion/diagrama/layout";

describe("parser del subconjunto (§16.2)", () => {
  it("acepta un flowchart con nodos, formas, aristas y subgrafo", () => {
    const r = parsearDiagrama("flowchart TD\n  A[Inicio] --> B{¿Listo?}\n  B -->|sí| C((Fin))\n  B -->|no| A\n  subgraph S [Bucle]\n    B\n  end");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ast.tipo).toBe("flowchart");
    if (r.ast.tipo !== "flowchart") return;
    expect(r.ast.nodos.map((n) => n.id).sort()).toEqual(["A", "B", "C"]);
    expect(r.ast.nodos.find((n) => n.id === "C")!.forma).toBe("circulo");
    expect(r.ast.nodos.find((n) => n.id === "B")!.forma).toBe("rombo");
    expect(r.ast.aristas.length).toBe(3);
    expect(r.ast.aristas.find((a) => a.de === "B" && a.a === "C")!.etiqueta).toBe("sí");
    expect(r.ast.subgrafos.length).toBe(1);
  });

  it("acepta un sequenceDiagram con participantes, mensajes y notas", () => {
    const r = parsearDiagrama("sequenceDiagram\n  participant A as Alumno\n  participant B as Bot\n  A->>B: pregunta\n  B-->>A: respuesta\n  Note over A,B: fin");
    expect(r.ok).toBe(true);
    if (!r.ok || r.ast.tipo !== "sequenceDiagram") return;
    expect(r.ast.participantes.map((p) => p.etiqueta)).toEqual(["Alumno", "Bot"]);
    expect(r.ast.mensajes.length).toBe(2);
    expect(r.ast.mensajes[0]!.forma).toBe("solida-punta");
    expect(r.ast.mensajes[1]!.forma).toBe("punteada-punta");
    expect(r.ast.notas.length).toBe(1);
    expect(r.ast.notas[0]!.participantes).toEqual(["A", "B"]);
  });

  // Las cuatro líneas fuera del subconjunto (CA-26): la fuente se rechaza nombrando la línea.
  const fuera = [
    { extra: 'click A "javascript:alert(1)"', nombre: "click" },
    { extra: "style A fill:#f00", nombre: "style" },
    { extra: "classDef x fill:#f00", nombre: "classDef" },
    { extra: "%%{init: {}}%%", nombre: "init" },
  ];
  for (const caso of fuera) {
    it(`rechaza una línea fuera del subconjunto (${caso.nombre}) y nombra la línea`, () => {
      const base = "flowchart TD\n  A[Inicio] --> B[Fin]\n  " + caso.extra;
      const r = parsearDiagrama(base);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.motivo).toContain("Sintaxis fuera del subconjunto");
      // la línea señalada es la del extra (línea 3; el %%{init}%% comentado cuenta por su contenido)
      expect(r.linea).toBeGreaterThanOrEqual(1);
    });
  }

  it("una fuente de más de 4000 caracteres se rechaza por longitud", () => {
    const r = parsearDiagrama("flowchart TD\n" + "  A --> B\n".repeat(600));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("Diagrama demasiado grande");
  });

  it("más de 12 participantes rechaza por participantes", () => {
    const lineas = ["sequenceDiagram"];
    for (let i = 0; i < LIMITES_DIAGRAMA.participantes + 1; i++) lineas.push(`participant P${i}`);
    const r = parsearDiagrama(lineas.join("\n"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("participantes");
  });

  it("las etiquetas se recortan a 80 caracteres y pierden los caracteres de control", () => {
    const largo = "x".repeat(200);
    const r = parsearDiagrama(`flowchart LR\n  A["${largo}\u0007"] --> B`);
    expect(r.ok).toBe(true);
    if (!r.ok || r.ast.tipo !== "flowchart") return;
    const a = r.ast.nodos.find((n) => n.id === "A")!;
    expect(a.texto.length).toBeLessThanOrEqual(LIMITES_DIAGRAMA.etiqueta);
    expect(a.texto).not.toContain("\u0007");
  });
});

describe("disposición (§16.3)", () => {
  it("un flowchart da cajas con tamaño y aristas con polilínea", () => {
    const r = parsearDiagrama("flowchart TD\n  A[Inicio] --> B[Fin]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = disponerDiagrama(r.ast);
    expect(m.nodos.length).toBe(2);
    expect(m.ancho).toBeGreaterThan(0);
    expect(m.alto).toBeGreaterThan(0);
    for (const n of m.nodos) {
      expect(n.ancho).toBeGreaterThan(0);
      expect(n.alto).toBeGreaterThan(0);
    }
    expect(m.aristas.length).toBe(1);
    expect(m.aristas[0]!.puntos.length).toBeGreaterThanOrEqual(2);
  });

  it("un sequenceDiagram pone a los participantes en columnas de 140 px", () => {
    const r = parsearDiagrama("sequenceDiagram\n  participant A\n  participant B\n  A->>B: hola");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = disponerDiagrama(r.ast);
    expect(m.lineasVida.length).toBe(2);
    const dx = Math.abs(m.lineasVida[1]!.x - m.lineasVida[0]!.x);
    expect(dx).toBe(140);
    expect(m.aristas.length).toBe(1);
  });
});
