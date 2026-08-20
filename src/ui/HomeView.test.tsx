import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { HomeView } from "@/ui/HomeView";
import { createDb } from "@/db/schema";
import { SEED_GOAL_ID, SEED_MODULE_ID } from "@/lib/seed";

afterEach(cleanup);

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
