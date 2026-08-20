import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AccessGate } from "@/ui/AccessGate";

// ACCESS GATE — the network-ambiguity contract, pinned. A captive portal (a campus WiFi login
// wall) answers /api/session with its OWN page: HTML behind a 200/302, or a hung socket. That is
// NOT a verdict from our server — the gate must fall back to the device's prior successful login
// (the localStorage flag), never lock the learner out of an app whose data is local-first. Only a
// definitive JSON verdict from OUR endpoint decides; the flag is only cleared by a deliberate
// logout ("Salir"). These tests pin exactly that behavior against regressions.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
});

function stubSession(impl: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => impl()) as unknown as typeof fetch,
  );
}

describe("AccessGate — captive portals and network garbage never lock a logged-in device", () => {
  it("portal HTML (json() throws) + prior login flag → the app opens (offline-trust fallback)", async () => {
    localStorage.setItem("arcanum_authed", "1");
    stubSession(() =>
      Promise.resolve({
        json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON")),
      }),
    );
    render(
      <AccessGate>
        <div>APP-VIVA</div>
      </AccessGate>,
    );
    await waitFor(() => expect(screen.getByText("APP-VIVA")).toBeInTheDocument());
  });

  it("network failure (fetch rejects) + prior login flag → the app opens", async () => {
    localStorage.setItem("arcanum_authed", "1");
    stubSession(() => Promise.reject(new TypeError("Failed to fetch")));
    render(
      <AccessGate>
        <div>APP-VIVA</div>
      </AccessGate>,
    );
    await waitFor(() => expect(screen.getByText("APP-VIVA")).toBeInTheDocument());
  });

  it("network failure WITHOUT a prior login → the gate stays closed (fail-closed for a fresh device)", async () => {
    stubSession(() => Promise.reject(new TypeError("Failed to fetch")));
    render(
      <AccessGate>
        <div>APP-VIVA</div>
      </AccessGate>,
    );
    await waitFor(() => expect(screen.getByText(/el régimen es de uno solo/)).toBeInTheDocument());
    expect(screen.queryByText("APP-VIVA")).toBeNull();
  });

  it("a definitive {authed:false} from OUR server → login screen (real expiry is respected)", async () => {
    localStorage.setItem("arcanum_authed", "1"); // even with a stale flag: the server's verdict wins
    stubSession(() => Promise.resolve({ json: () => Promise.resolve({ authed: false, configured: true }) }));
    render(
      <AccessGate>
        <div>APP-VIVA</div>
      </AccessGate>,
    );
    await waitFor(() => expect(screen.getByText(/el régimen es de uno solo/)).toBeInTheDocument());
    expect(screen.queryByText("APP-VIVA")).toBeNull();
  });

  it("unconfigured (no env password, dev) → open gate", async () => {
    stubSession(() => Promise.resolve({ json: () => Promise.resolve({ authed: false, configured: false }) }));
    render(
      <AccessGate>
        <div>APP-VIVA</div>
      </AccessGate>,
    );
    await waitFor(() => expect(screen.getByText("APP-VIVA")).toBeInTheDocument());
  });
});
