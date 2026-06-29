import { describe, it, expect, vi } from "vitest";
import { routeWithFallback } from "@/core/ai-router";

describe("routeWithFallback", () => {
  it("uses the first provider when it succeeds", async () => {
    const call = vi.fn(async (p: string) => `ok:${p}`);
    const r = await routeWithFallback(["openai", "anthropic"], call);
    expect(r).toEqual({ provider: "openai", value: "ok:openai" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next provider when the primary fails", async () => {
    const call = vi.fn(async (p: string) => {
      if (p === "openai") throw new Error("rate limit");
      return `ok:${p}`;
    });
    const r = await routeWithFallback(["openai", "anthropic"], call);
    expect(r).toEqual({ provider: "anthropic", value: "ok:anthropic" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("priority is config: reversing the order flips the primary", async () => {
    const call = async (p: string) => `ok:${p}`;
    expect((await routeWithFallback(["anthropic", "openai"], call)).provider).toBe("anthropic");
  });

  it("throws when every provider fails (caller degrades honestly)", async () => {
    const call = async () => {
      throw new Error("no key");
    };
    await expect(routeWithFallback(["openai", "anthropic"], call)).rejects.toThrow();
  });

  it("throws when there are no providers", async () => {
    await expect(routeWithFallback([], async () => "x")).rejects.toThrow();
  });
});
