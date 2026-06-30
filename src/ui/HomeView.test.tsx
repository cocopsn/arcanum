import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { HomeView } from "@/ui/HomeView";
import { createDb } from "@/db/schema";

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
});
