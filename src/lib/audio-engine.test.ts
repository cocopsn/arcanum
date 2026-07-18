import { describe, it, expect, vi } from "vitest";
import type { Sfx } from "@/lib/audio";

// STRUCTURAL audio tests. The sound itself CANNOT be heard here (no Web Audio in happy-dom, no output
// device in CI) — that part is the learner's ears. What IS provable, and is proven below: a gesture
// really creates nodes, muting creates NOT ONE node, every node self-terminates (no leak), the SFX and
// music buses carry independent levels, the context is resumed (iOS autoplay), and leaving a world stops
// its drone. A fake AudioContext records everything the engine does.

interface Rec {
  oscillators: FakeOsc[];
  gains: FakeGain[];
  resumed: number;
  ctxCreated: number;
}
let rec: Rec = { oscillators: [], gains: [], resumed: 0, ctxCreated: 0 };

class FakeParam {
  value = 0;
  setValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
class FakeNode {
  connect(dest: unknown) {
    return dest;
  }
  disconnect() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
  constructor() {
    super();
    rec.gains.push(this);
  }
}
class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  started = false;
  stopped = false;
  constructor() {
    super();
    rec.oscillators.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
}
class FakeCtx {
  currentTime = 0;
  state: "suspended" | "running" = "suspended";
  destination = new FakeNode();
  constructor() {
    rec.ctxCreated++;
  }
  createGain() {
    return new FakeGain();
  }
  createOscillator() {
    return new FakeOsc();
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  resume() {
    rec.resumed++;
    this.state = "running";
    return Promise.resolve();
  }
}

/** a pristine engine + a pristine recorder for each test (the engine is a module singleton) */
async function fresh() {
  rec = { oscillators: [], gains: [], resumed: 0, ctxCreated: 0 };
  localStorage.clear();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  vi.resetModules();
  const mod = await import("@/lib/audio");
  return mod.audio;
}

// the FULL palette — if an id is ever added without a synth case, the "no silent id" test fails
const ALL_SFX: Sfx[] = [
  "click", "reveal", "gate", "xp", "error", "ascension",
  "step", "heart", "resolve", "lessonwin",
  "toggle", "nav", "open", "close", "primary", "secondary", "success", "blocked", "saved", "import",
];

describe("audio engine — structural (the sound can't be heard here; the wiring can be proven)", () => {
  it("unlock() creates the context ONCE and resumes it (iOS blocks autoplay until a gesture)", async () => {
    const audio = await fresh();
    expect(rec.ctxCreated).toBe(0); // nothing before a gesture
    audio.unlock();
    expect(rec.ctxCreated).toBe(1);
    expect(rec.resumed).toBe(1);
    audio.unlock(); // more gestures must not stack contexts
    expect(rec.ctxCreated).toBe(1);
  });

  it("EVERY id in the palette really fires nodes — no sound is a silent no-op", async () => {
    const audio = await fresh();
    audio.unlock();
    for (const name of ALL_SFX) {
      const before = rec.oscillators.length;
      expect(() => audio.sfx(name)).not.toThrow();
      expect(rec.oscillators.length).toBeGreaterThan(before);
    }
  });

  it("every oscillator SELF-TERMINATES (started + stopped) — no leaked nodes", async () => {
    const audio = await fresh();
    audio.unlock();
    ALL_SFX.forEach((n) => audio.sfx(n));
    expect(rec.oscillators.length).toBeGreaterThan(0);
    expect(rec.oscillators.every((o) => o.started && o.stopped)).toBe(true);
  });

  it("SFX muted → NOT ONE node is created (the config truly silences; it doesn't just lower a fader)", async () => {
    const audio = await fresh();
    audio.unlock();
    audio.setConfig({ sfx: false });
    const before = rec.oscillators.length;
    ALL_SFX.forEach((n) => audio.cue(n));
    expect(rec.oscillators.length).toBe(before);
  });

  it("sfxVol and musicVol drive their OWN bus — independent levels under master", async () => {
    const audio = await fresh();
    audio.unlock();
    audio.setConfig({ sfx: true, sfxVol: 0.25, music: true, musicVol: 0.6, master: 0.5 });
    const vals = rec.gains.map((g) => g.gain.value);
    expect(vals).toContain(0.5); // master
    expect(vals).toContain(0.25); // sfx bus — independent of music
    expect(vals).toContain(0.6); // music bus
    audio.setConfig({ sfx: false });
    expect(rec.gains.map((g) => g.gain.value)).toContain(0); // muting drops the SFX bus to silence
  });

  it("cue() = unlock + play, so no gesture can be wired without arming the context", async () => {
    const audio = await fresh();
    audio.cue("toggle"); // no prior unlock at all
    expect(rec.ctxCreated).toBe(1);
    expect(rec.resumed).toBe(1);
    expect(rec.oscillators.length).toBeGreaterThan(0);
  });

  it("ambient: silent while music is OFF, a drone per world when ON, and STOPPED on leaving (no leak)", async () => {
    const audio = await fresh();
    audio.unlock();
    audio.setWorld("fred");
    expect(rec.oscillators.length).toBe(0); // music defaults OFF → the world stays silent (honest)
    audio.setConfig({ music: true });
    expect(rec.oscillators.length).toBeGreaterThan(0); // roots + the breathing LFO
    audio.setWorld(null);
    expect(rec.oscillators.every((o) => o.stopped)).toBe(true); // leaving stops every node it opened
  });

  it("an unknown world slug is no world — never throws, never invents a drone", async () => {
    const audio = await fresh();
    audio.unlock();
    audio.setConfig({ music: true });
    expect(() => audio.setWorld("nonsense-realm")).not.toThrow();
    expect(rec.oscillators.length).toBe(0);
  });

  it("OFFLINE: firing every SFX + the ambient drone makes ZERO network calls — no fetch, no asset, no <audio>", async () => {
    const audio = await fresh();
    const g = globalThis as unknown as { fetch?: unknown; XMLHttpRequest?: unknown; Audio?: unknown };
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    const audioElSpy = vi.fn();
    const orig = { fetch: g.fetch, XMLHttpRequest: g.XMLHttpRequest, Audio: g.Audio };
    g.fetch = fetchSpy;
    g.XMLHttpRequest = class {
      constructor() {
        xhrSpy();
      }
    };
    g.Audio = class {
      constructor() {
        audioElSpy();
      }
    };
    try {
      audio.unlock();
      audio.setConfig({ music: true });
      ALL_SFX.forEach((n) => audio.cue(n)); // every interaction sound
      audio.setWorld("fred"); // start a drone
      audio.setWorld("competitiva"); // crossfade to another
      // Web Audio synthesizes every sample locally → the engine touches the network NOT ONCE, and never
      // falls back to an <audio> element / fetched loop. This is why the whole layer works offline.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSpy).not.toHaveBeenCalled();
      expect(audioElSpy).not.toHaveBeenCalled();
      expect(rec.oscillators.length).toBeGreaterThan(0); // it DID produce sound — just all synthesized
    } finally {
      g.fetch = orig.fetch;
      g.XMLHttpRequest = orig.XMLHttpRequest;
      g.Audio = orig.Audio;
    }
  });
});
