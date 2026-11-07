import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosNotInstalled, storageReport } from "@/lib/storage";

// storageReport of the offline facade (design poblar §6.7). Red-check in redchecks-offline-motor.md: skipping
// iosSinInstalar → «Safari sin instalar no avisó del borrado a 7 días».

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
afterEach(() => vi.unstubAllGlobals());

describe("isIosNotInstalled", () => {
  it("Safari de iPhone sin instalar sí; instalada (standalone o display-mode) no", () => {
    expect(isIosNotInstalled({ userAgent: IPHONE }), "Safari sin instalar no avisó del borrado a 7 días").toBe(true);
    expect(isIosNotInstalled({ userAgent: IPHONE, standalone: true })).toBe(false);
    expect(isIosNotInstalled({ userAgent: IPHONE, displayStandalone: true })).toBe(false);
  });
  it("iPadOS (MacIntel con toque) sí; un Mac de escritorio y Android no", () => {
    expect(isIosNotInstalled({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIosNotInstalled({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIosNotInstalled({ userAgent: "Mozilla/5.0 (Linux; Android 15)" })).toBe(false);
  });
});

describe("storageReport", () => {
  it("informa persisted, uso y cuota en bytes", async () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: IPHONE, storage: { persisted: async () => false, estimate: async () => ({ usage: 1234, quota: 99999 }) } });
    expect(await storageReport()).toEqual({ persistente: false, usoBytes: 1234, cuotaBytes: 99999, iosSinInstalar: true });
  });
  it("sin storage, null en lo que no se sabe", async () => {
    vi.stubGlobal("navigator", { userAgent: "x", platform: "", maxTouchPoints: 0 });
    expect(await storageReport()).toEqual({ persistente: null, usoBytes: null, cuotaBytes: null, iosSinInstalar: false });
  });
});
