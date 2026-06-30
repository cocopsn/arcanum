import { describe, it, expect } from "vitest";
import { audio } from "@/lib/audio";

// The audio CONFIG layer is testable without an AudioContext (the synth/ambient need a browser
// AudioContext, verified live). Config is a DEVICE preference persisted to localStorage, not log state.
describe("audio config — device preference, persisted, no AudioContext required", () => {
  it("setConfig updates getConfig and persists to localStorage", () => {
    audio.setConfig({ sfx: false, master: 0.5 });
    expect(audio.getConfig().sfx).toBe(false);
    expect(audio.getConfig().master).toBe(0.5);
    expect(JSON.parse(localStorage.getItem("arcanum_audio")!).sfx).toBe(false);
  });

  it("subscribe fires on every config change", () => {
    let got: { music?: boolean } | null = null;
    const unsub = audio.subscribe((c) => (got = c));
    audio.setConfig({ music: true });
    expect(got).not.toBeNull();
    expect(got!.music).toBe(true);
    unsub();
  });

  it("setWorld / sfx are safe BEFORE unlock (no AudioContext) — they no-op, never throw", () => {
    expect(() => {
      audio.setWorld("itc");
      audio.setWorld("nonsense-realm"); // unknown slug → treated as null
      audio.sfx("click");
      audio.setWorld(null);
    }).not.toThrow();
  });
});
