import { describe, expect, it } from "vitest";
import { routePlan, worldPlan } from "@/forge/offline/plan";
import type { OfflineIndex } from "@/lib/offline/types";
import realIndex from "@/forge/data/offline-index.json";

// The download plan (design poblar §6.4 step 3), with the real generated index. Red-check in
// redchecks-offline-motor.md: repeating shared partitions → «el mundo baja dos veces docs/en/foundry/…».

const index = realIndex as unknown as OfflineIndex;
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("plan de descarga", () => {
  it("una ruta es su entrada del índice; un slug desconocido no tiene plan", () => {
    const p = routePlan(index, "s1")!;
    expect(p.key).toBe("forge:s1");
    expect(p.libros).toEqual(index.rutas.s1!.libros);
    expect(p).toMatchObject({ python: true, sqlite: true });
    expect(routePlan(index, "no-existe")).toBeNull();
    expect(routePlan(index, "__proto__")).toBeNull();
  });
  it("el mundo une las 19 rutas sin repetir libros, bancos, particiones ni figuras", () => {
    const w = worldPlan(index);
    for (const f of dupes(w.atlas.map((a) => a.file))) expect.fail(`el mundo baja dos veces ${f}`);
    expect(dupes(w.libros.map((l) => l.code))).toEqual([]);
    expect(dupes(w.bancos)).toEqual([]);
    expect(dupes(w.figuras)).toEqual([]);
    const per = Object.values(index.rutas);
    expect(w.libros).toHaveLength(per.reduce((n, r) => n + r.libros.length, 0));
    expect(new Set(w.atlas.map((a) => a.file))).toEqual(new Set(per.flatMap((r) => r.atlas.map((a) => a.file))));
    expect(w.atlas.length, "hay particiones compartidas entre rutas: el mundo debe bajar menos que la suma").toBeLessThan(per.reduce((n, r) => n + r.atlas.length, 0));
    expect(w).toMatchObject({ key: "forge:mundo", python: true, sqlite: true });
  });
});
