import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const invoke = vi.fn();
vi.mock("@/sync/client", () => ({
  getSupabase: () => ({ auth: { getSession }, functions: { invoke } }),
}));

import { ocrImage, enrichSleepCycle, requestInterrogation } from "@/sync/ai";

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

  it("requestInterrogation returns null without a session (caller falls to heuristic)", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await requestInterrogation({ notes: "x" })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("requestInterrogation returns null when the function is down (no placebo pass)", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({ data: { error: "IA no disponible" }, error: null });
    expect(await requestInterrogation({ notes: "x" })).toBeNull();
  });

  it("requestInterrogation maps the interrogator's questions + verdict on success", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    invoke.mockResolvedValue({
      data: { questions: ["¿por qué desborda un int?"], passed: false, score: 0.3, summary: "flojo", feedback: "deriva el complemento a dos", provider: "openai" },
      error: null,
    });
    const r = (await requestInterrogation({ notes: "x" }))!;
    expect(r.questions).toEqual(["¿por qué desborda un int?"]);
    expect([r.passed, r.score, r.provider]).toEqual([false, 0.3, "openai"]);
  });
});
