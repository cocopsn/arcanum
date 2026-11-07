import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { HomeView } from "@/ui/HomeView";
import { createDb, type ArcanumDB } from "@/db/schema";
import { SEED_GOAL_ID, SEED_MODULE_ID } from "@/lib/seed";
import { HOME_ORDER_KEY } from "@/lib/home-order";

afterEach(cleanup);

/** Número de eventos del log una vez que la siembra de la hidratación dejó de escribir. */
async function settledEventCount(db: ArcanumDB): Promise<number> {
  let prev = await db.events.count();
  for (let k = 0; k < 40; k++) {
    await new Promise((r) => setTimeout(r, 50));
    const now = await db.events.count();
    if (now === prev) return now;
    prev = now;
  }
  return prev;
}

describe("HomeView · orden de los mundos (diseño poblar §8)", () => {
  it("«Ordenar» moves a world with ↑/↓, announces its position, never writes the log and «Restablecer orden» clears the key", async () => {
    localStorage.clear();
    const db = createDb(`home-order-${Math.round(performance.now())}-${Math.random()}`);
    try {
      render(
        <ArcanumProvider db={db}>
          <HomeView />
        </ArcanumProvider>,
      );
      await waitFor(() => expect(screen.getByText("ITC")).toBeInTheDocument());
      const before = await settledEventCount(db);

      fireEvent.click(screen.getByRole("button", { name: "Ordenar" }));
      expect(screen.getByRole("button", { name: "Listo" })).toHaveAttribute("aria-pressed", "true");
      const ups = screen.getAllByRole("button", { name: /^Subir / });
      const downs = screen.getAllByRole("button", { name: /^Bajar / });
      expect(ups.length, "hace falta más de un mundo para ordenar").toBeGreaterThan(1);
      expect(ups[0], "el primer mundo no puede subir").toBeDisabled();
      expect(downs[downs.length - 1], "el último mundo no puede bajar").toBeDisabled();
      expect(screen.getByRole("button", { name: "Subir ITC" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bajar ITC" })).toBeInTheDocument();
      const restablecer = screen.getByRole("button", { name: "Restablecer orden" });
      expect(restablecer, "con el orden de omisión no hay nada que restablecer").toBeDisabled();

      // el primer mundo por omisión baja una posición
      const first = downs[0]!.getAttribute("aria-label")!.replace(/^Bajar /, "");
      fireEvent.click(downs[0]!);
      const said = `${first} ahora está en la posición 2 de ${downs.length}`;
      await waitFor(() => expect(screen.getByText(said)).toBeInTheDocument());
      const saved = JSON.parse(localStorage.getItem(HOME_ORDER_KEY) ?? "null") as { v: number; order: string[] } | null;
      expect(saved?.v).toBe(1);
      expect(saved?.order).toHaveLength(downs.length);
      expect(screen.getByRole("button", { name: `Subir ${first}` }), "el mundo movido no quedó en la posición 2").not.toBeDisabled();
      expect(screen.getByText("Este orden vive sólo en este dispositivo; no se sincroniza.")).toBeInTheDocument();

      expect(await settledEventCount(db), "ordenar escribió en el log").toBe(before);

      fireEvent.click(screen.getByRole("button", { name: "Restablecer orden" }));
      expect(localStorage.getItem(HOME_ORDER_KEY), "«Restablecer orden» no borró la llave del dispositivo").toBeNull();
      expect(screen.getByRole("button", { name: "Restablecer orden" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Listo" }));
      expect(screen.queryByRole("button", { name: /^Subir / })).toBeNull();
    } finally {
      localStorage.clear();
      await db.delete();
    }
  });

  it("a stored order is applied on boot and a corrupt one leaves the default order", async () => {
    localStorage.clear();
    localStorage.setItem(HOME_ORDER_KEY, "{roto");
    const db = createDb(`home-order-corrupt-${Math.round(performance.now())}-${Math.random()}`);
    try {
      render(
        <ArcanumProvider db={db}>
          <HomeView />
        </ArcanumProvider>,
      );
      await waitFor(() => expect(screen.getByText("ITC")).toBeInTheDocument());
      expect(screen.getByText(/La sala del trono/)).toBeInTheDocument();
    } finally {
      localStorage.clear();
      await db.delete();
    }
  });

  it("HomeView reads the safe areas through var(--safe-*), never env() directly (anexo-r2 [2])", () => {
    const src = readFileSync(path.join(process.cwd(), "src/ui/HomeView.tsx"), "utf8");
    expect(src.includes("env(safe-area-inset"), "HomeView.tsx usa env(safe-area-inset…) directo en lugar de var(--safe-*)").toBe(false);
  });

  it("the header and footer controls are 44 px tap targets (.tap)", async () => {
    localStorage.clear();
    const db = createDb(`home-tap-${Math.round(performance.now())}-${Math.random()}`);
    try {
      render(
        <ArcanumProvider db={db}>
          <HomeView />
        </ArcanumProvider>,
      );
      await waitFor(() => expect(screen.getByText("ITC")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /^Cambiar a modo / }).className, "LayoutToggle no lleva .tap").toMatch(/\btap\b/);
      expect(screen.getByRole("button", { name: "Mapa" }).className, "los botones del pie no llevan .tap").toMatch(/\btap\b/);
      expect(screen.getByRole("button", { name: "Ordenar" }).className, "«Ordenar» no lleva .tap").toMatch(/\btap\b/);
    } finally {
      localStorage.clear();
      await db.delete();
    }
  });
});

describe("HomeView", () => {
  it("renders the seeded ITC goal + derived grade from the real read-model", async () => {
    const db = createDb(`home-${Math.round(performance.now())}-${Math.random()}`);
    render(
      <ArcanumProvider db={db}>
        <HomeView />
      </ArcanumProvider>,
    );

    // hydration is async (useEffect → seed → project)
    await waitFor(() => expect(screen.getByText("ITC")).toBeInTheDocument());

    // home is the throne hall: the ITC world portal (its temper), not a flat cell list
    expect(screen.getByText(/La sala del trono/)).toBeInTheDocument();
    // grade is DERIVED (0 XP → Scintilla), not hardcoded
    expect(screen.getByLabelText("Sello Scintilla")).toBeInTheDocument();
    expect(screen.getByText("SCINTILLA")).toBeInTheDocument();
    // rito pending because the seed has no qualifying event today
    expect(screen.getByText(/Aún no dejas marca hoy/i)).toBeInTheDocument();

    await db.delete();
  });

  it("RESUME: a stored location (world + cell) reopens after boot instead of landing on the throne hall", async () => {
    // the device-local resume left by a reload (a discard / OS kill / deploy never runs cleanups)
    localStorage.clear();
    localStorage.setItem(
      "arcanum_resume",
      JSON.stringify({ v: 1, world: SEED_GOAL_ID, cell: SEED_MODULE_ID, bookId: null, library: false, ts: 1 }),
    );
    const db = createDb(`home-resume-${Math.round(performance.now())}-${Math.random()}`);
    try {
      render(
        <ArcanumProvider db={db}>
          <HomeView />
        </ArcanumProvider>,
      );
      // the ITC world map reopens (cell titles only render inside the map/sheet, never on home)
      await waitFor(() => expect(screen.getAllByText(/CS50/).length).toBeGreaterThan(0));
    } finally {
      localStorage.clear();
      await db.delete();
    }
  });

  it("RESUME fail-closed: a stale/foreign stored location is ignored (home renders, nothing broken)", async () => {
    localStorage.clear();
    localStorage.setItem(
      "arcanum_resume",
      JSON.stringify({ v: 1, world: "00000000-0000-4000-8000-00000000dead", cell: "también-falso", bookId: "nope", library: false, ts: 1 }),
    );
    const db = createDb(`home-resume-stale-${Math.round(performance.now())}-${Math.random()}`);
    try {
      render(
        <ArcanumProvider db={db}>
          <HomeView />
        </ArcanumProvider>,
      );
      await waitFor(() => expect(screen.getByText(/La sala del trono/)).toBeInTheDocument());
      // no map/sheet opened for the unknown ids — the throne hall is the honest landing
      expect(screen.queryByText(/CS50/)).toBeNull();
    } finally {
      localStorage.clear();
      await db.delete();
    }
  });
});
