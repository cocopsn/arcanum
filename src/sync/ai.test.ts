import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const invoke = vi.fn();
vi.mock("@/sync/client", () => ({
  getSupabase: () => ({ auth: { getSession }, functions: { invoke } }),
}));

import { ocrImage, enrichSleepCycle } from "@/sync/ai";

beforeEach(() => {
  getSession.mockReset();
  invoke.mockReset();
});

describe("ai client — honest degradation (trunk stays alive without AI)", () => {
  it("ocrImage requires a session; never calls the function otherwise", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(ocrImage("data:image/png;base64,xx")).rejects.toThrow(/Inicia sesión/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("ocrImage surfaces the Edge Function error honestly (e.g. key absent)", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({ data: { error: "IA no disponible: OPENAI_API_KEY ausente" }, error: null });
    await expect(ocrImage("data:image/png;base64,xx")).rejects.toThrow(/IA no disponible/);
  });

  it("ocrImage returns markdown + provider on success", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({ data: { markdown: "# Página\ntexto", provider: "openai" }, error: null });
    expect(await ocrImage("data:image/png;base64,xx")).toEqual({ markdown: "# Página\ntexto", provider: "openai" });
  });

  it("enrichSleepCycle returns null when the function is down (no placebo digest)", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({ data: { error: "IA no disponible" }, error: null });
    expect(await enrichSleepCycle({ x: 1 })).toBeNull();
  });

  it("enrichSleepCycle returns null without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await enrichSleepCycle({ x: 1 })).toBeNull();
  });
});
