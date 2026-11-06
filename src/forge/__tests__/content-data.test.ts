import { describe, it, expect } from "vitest";
import type { ForgeCellData, ForgeRouteData } from "@/forge/data/types";
import { FORGE_CAPABILITIES, FORGE_CRITICAL_CONDITIONS } from "@/core/forge-verdict";
import { FORGE_CELL_CODES, forgeCellId } from "@/forge/ids";
import { FORGE_SPINE } from "@/lib/spines-forge";
import maestroUrls from "@/forge/data/maestro-urls.json";
import catalog from "@/forge/data/catalog.json";
import projects from "@/forge/data/projects.json";
import pilots from "@/forge/data/pilots.json";
import guias from "@/forge/data/guias.json";
import f0 from "@/forge/data/routes/f0.json";
import a1 from "@/forge/data/routes/a1.json";
import a2 from "@/forge/data/routes/a2.json";
import s1 from "@/forge/data/routes/s1.json";
import s2 from "@/forge/data/routes/s2.json";
import p1 from "@/forge/data/routes/p1.json";
import p2 from "@/forge/data/routes/p2.json";
import p3 from "@/forge/data/routes/p3.json";
import p4 from "@/forge/data/routes/p4.json";
import p5 from "@/forge/data/routes/p5.json";
import f1 from "@/forge/data/routes/f1.json";
import f2 from "@/forge/data/routes/f2.json";
import sw1 from "@/forge/data/routes/sw1.json";
import sw2 from "@/forge/data/routes/sw2.json";
import sw3 from "@/forge/data/routes/sw3.json";
import sw4 from "@/forge/data/routes/sw4.json";
import diagnostico from "@/forge/data/routes/diagnostico.json";
import retos from "@/forge/data/routes/retos.json";
import expedientes from "@/forge/data/routes/expedientes.json";
import fixP2 from "@/forge/__tests__/fixtures/routes/p2.json";
import fixF1 from "@/forge/__tests__/fixtures/routes/f1.json";

const ROUTES = [f0, a1, a2, s1, s2, p1, p2, p3, p4, p5, f1, f2, sw1, sw2, sw3, sw4, diagnostico, retos, expedientes] as unknown as ForgeRouteData[];
const CELLS = ROUTES.flatMap((r) => r.cells) as ForgeCellData[];
const SHA = (maestroUrls as { maestro_sha10: string }).maestro_sha10;
const fichaText = (c: ForgeCellData) => [c.ficha.foco, c.ficha.resultado, c.ficha.mision, c.ficha.defensa, c.ficha.variante, c.ficha.transferencia].filter(Boolean).join("\n");

describe("curriculum data extracted from the master program (CA-14 … CA-17, §5)", () => {
  it("every file comes from the same master program (maestro_sha10)", () => {
    for (const r of ROUTES) expect(r.maestro_sha10, r.slug).toBe(SHA);
    for (const d of [catalog, projects, pilots, guias] as { maestro_sha10: string }[]) expect(d.maestro_sha10).toBe(SHA);
  });

  it("CA-14: the 168 codes resolve to a cell with its mandatory fields non-empty", () => {
    expect(CELLS.map((c) => c.code)).toEqual([...FORGE_CELL_CODES]);
    for (const c of CELLS) {
      expect(c.id, c.code).toBe(forgeCellId(c.code));
      expect(c.title.startsWith(`${c.code} · `), c.code).toBe(true);
      expect(c.ficha.mision.trim(), `${c.code} sin misión`).not.toBe("");
      expect(c.ficha.defensa.trim(), `${c.code} sin defensa`).not.toBe("");
      if (c.cls === "ruta") {
        expect(c.ficha.fuentes.length, `${c.code} sin lecturas`).toBeGreaterThan(0);
        for (const f of c.ficha.fuentes) expect(f.url, c.code).toMatch(/^https:\/\//);
      }
    }
  });

  it("CA-15: every URL a fiche cites is in its cell (against the versioned code→URLs extraction)", () => {
    const urls = (maestroUrls as { urls: Record<string, string[]> }).urls;
    const byId = new Map(FORGE_SPINE.cells.map((c) => [c.id, c]));
    for (const c of CELLS) {
      const spine = byId.get(c.id)!;
      for (const u of urls[c.code] ?? []) expect(spine.sourceUrls, `${c.code} perdió ${u}`).toContain(u);
    }
  });

  it("CA-16: ≥ 1 valid capability and ≥ 1 critical condition with literal traces; valid nature and scope", () => {
    const caps = new Set<string>(FORGE_CAPABILITIES);
    const crit = new Set<string>(FORGE_CRITICAL_CONDITIONS);
    for (const c of CELLS) {
      const text = fichaText(c);
      expect(c.capacidades.length, c.code).toBeGreaterThan(0);
      for (const k of c.capacidades) {
        expect(caps.has(k), `${c.code}: capacidad inválida ${k}`).toBe(true);
        expect(text.includes(c.rastroCapacidades[k] ?? "\u0000"), `${c.code}: el rastro de ${k} no es literal de la ficha`).toBe(true);
      }
      expect(c.criticas.length, c.code).toBeGreaterThan(0);
      for (const k of c.criticas) {
        expect(crit.has(k.id) || k.id.startsWith("otra:"), `${c.code}: condición inválida ${k.id}`).toBe(true);
        expect(text.includes(k.rastro), `${c.code}: el rastro de ${k.id} no es literal de la ficha`).toBe(true);
      }
      expect(["a_mano", "delegable", "mixto"]).toContain(c.naturaleza.valor);
      expect(["local", "local+nativa"]).toContain(c.alcance);
    }
    const mixed = CELLS.filter((c) => c.naturaleza.valor !== "a_mano").map((c) => c.code);
    expect(mixed).toEqual(["A2-06", "F2-05"]);
    const a206 = CELLS.find((c) => c.code === "A2-06")!;
    expect(fichaText(a206)).toContain(a206.naturaleza.rastro!);
    const f205 = CELLS.find((c) => c.code === "F2-05")!;
    expect(JSON.stringify(f205.proyecto), "la naturaleza de F2-05 no sale de §10").toContain(f205.naturaleza.rastro!);
    for (const c of [a206, f205]) expect(c.naturaleza.parts?.map((p) => p.nature).sort()).toEqual(["a_mano", "delegable"]);
  });

  it("scope (§5.3) and English (RF-V8) follow the rule", () => {
    for (const c of CELLS) {
      const nativa = /^P[1-5]-/.test(c.code) || ["F0-08", "F2-01", "F2-02", "F2-03", "F2-04", "F2-06"].includes(c.code);
      expect(c.alcance, c.code).toBe(nativa ? "local+nativa" : "local");
    }
    expect(CELLS.filter((c) => c.requireEnglish).map((c) => c.code)).toEqual(["F1-06", "D8"]);
  });

  it("CA-17: every route's «Entrada» is kept as «Entrada recomendada» (codes), never as an edge", () => {
    for (const r of ROUTES.slice(0, 16)) {
      expect(r.header.entrada.trim(), r.slug).not.toBe("");
      for (const code of r.header.entradaRecomendada) expect(r.header.entrada, r.slug).toContain(code);
      expect(r.header.apoyo.length, `${r.slug} sin apoyo`).toBeGreaterThan(0);
    }
  });

  it("the compuerta carries its question and rubric (from the fiche and §05); D cells have none", () => {
    for (const c of CELLS) {
      if (c.compuerta === null) {
        expect(c.gate, c.code).toBeUndefined();
        continue;
      }
      expect(c.gate?.pregunta.trim(), `${c.code} sin pregunta de compuerta`).toBeTruthy();
      expect(c.gate?.pregunta).toBe(c.ficha.defensa);
      expect(c.gate?.rubrica[0], c.code).toMatch(/^Para aprobar una misión se exige al menos 3/);
      expect(c.gate!.rubrica.length, c.code).toBeGreaterThanOrEqual(2 + c.capacidades.length + c.criticas.length);
    }
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const c = CELLS.find((x) => x.code === `F2-0${n}`)!;
      expect(c.proyecto?.n, c.code).toBe(n);
      expect(c.proyecto!.campos.length, c.code).toBeGreaterThan(0);
    }
    const d1 = CELLS.find((c) => c.code === "D1")!;
    expect(d1.d?.minutos).toBe(45);
    expect(d1.d?.aplicacion).toMatch(/^repartir en dos sesiones/);
    for (const c of CELLS.filter((x) => x.cls === "expediente")) expect(c.sd?.pasadas, c.code).toMatch(/^diseño simple correcto/);
  });

  it("honesty labels (§5.5) sit on the right cells", () => {
    const lab = (code: string) => CELLS.find((c) => c.code === code)!.etiquetas;
    for (const c of CELLS.filter((x) => x.cls === "reto")) expect(c.etiquetas, c.code).toContain("reto_propio");
    for (const code of ["SD-02", "SD-03", "SD-08"]) expect(lab(code)).toContain("inspirado_catalogo");
    for (const code of ["A2-08", "F2-07"]) expect(lab(code)).toContain("formato_practica");
    expect(lab("F1-06")).toContain("transcripcion_f106");
    for (const c of CELLS) if (c.ficha.fuentes.some((f) => f.acceso === "cuenta")) expect(c.etiquetas, c.code).toContain("requiere_cuenta");
  });

  it("catalog.json: every cited key resolves; learn/certification are «cuenta»; nothing is «pago»; courses carry their label", () => {
    const claves = (catalog as { claves: Record<string, { url: string; acceso: string }> }).claves;
    for (const c of CELLS) for (const k of c.sd?.claves ?? []) expect(claves[k], `${c.code}: [${k}] no resuelve`).toBeDefined();
    for (const [k, v] of Object.entries(claves)) {
      const h = new URL(v.url).hostname;
      expect(v.acceso, k).toBe(h === "learn.palantir.com" || h === "certification.palantir.com" ? "cuenta" : "publico");
    }
    const cursos = (catalog as { cursos: Record<string, { honestidad: string }> }).cursos;
    expect(Object.keys(cursos)).toHaveLength(18);
    for (const v of Object.values(cursos)) expect(v.honestidad).toBe("Selección de unidades; no equivale a haber completado el curso");
    expect(JSON.stringify(catalog)).not.toMatch(/"acceso":"pago"/);
  });

  it("catalog.json: the 7 video rows of §12 point at real cells or routes, with their literal status and «Video no revisado»", () => {
    const videos = (catalog as { videos: { clave: string; celdas: string[]; rutas: string[]; estado: string; honestidad: string }[] }).videos;
    expect(videos).toHaveLength(7);
    const codes = new Set(CELLS.map((c) => c.code));
    const routeCodes = new Set(ROUTES.map((r) => r.code));
    for (const v of videos) {
      expect(v.celdas.length + v.rutas.length, v.clave).toBeGreaterThan(0);
      for (const c of v.celdas) expect(codes.has(c), `${v.clave}: ${c}`).toBe(true);
      for (const r of v.rutas) expect(routeCodes.has(r), `${v.clave}: ${r}`).toBe(true);
      expect(v.estado.trim()).not.toBe("");
      expect(v.honestidad).toBe("Video no revisado");
    }
    expect((catalog as { lecturas: unknown[] }).lecturas).toHaveLength(6);
    expect((catalog as { papers: unknown[] }).papers).toHaveLength(7);
  });

  it("projects (§10), pilots (§11) and guides (§04, §07, §14, §15) are extracted; nothing of the certifications of §21", () => {
    expect((projects as { proyectos: { code: string }[] }).proyectos.map((p) => p.code)).toEqual(["F2-01", "F2-02", "F2-03", "F2-04", "F2-05", "F2-06"]);
    expect((pilots as { pilotos: { code: string }[] }).pilotos.map((p) => p.code)).toEqual(["P2-06", "S2-02", "F1-03"]);
    expect((guias as { guias: { seccion: string }[] }).guias.map((g) => g.seccion)).toEqual(["04", "07", "14", "15"]);
    for (const d of [catalog, projects, pilots, guias, ...ROUTES]) expect(JSON.stringify(d)).not.toContain("certifications.ontologize.com");
  });

  it("the two-route fixture for the other branches is an exact copy of p2 and f1", () => {
    expect(fixP2).toEqual(p2);
    expect(fixF1).toEqual(f1);
  });
});
