"use client";

// SYSTEM AUDIO — fully SYNTHESIZED via Web Audio (zero asset files, zero cost, zero licence).
// SFX (premium, discreet — not cartoonish) + an ambient drone per WORLD + a device-local config
// (master/sfx/music, persisted to localStorage — a preference, NOT log state). iOS blocks autoplay:
// the context is created suspended and resumed on the first user gesture (unlock). All no-ops on SSR.

export type Sfx = "click" | "reveal" | "gate" | "xp" | "error" | "ascension";
export type WorldSlug = "itc" | "fred" | "competitiva" | "aleman";

export interface AudioConfig {
  master: number; // 0..1
  sfx: boolean;
  music: boolean;
  musicVol: number; // 0..1
}

const KEY = "arcanum_audio";
const DEFAULT: AudioConfig = { master: 0.7, sfx: true, music: false, musicVol: 0.4 };

function load(): AudioConfig {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      master: clamp(typeof raw.master === "number" ? raw.master : DEFAULT.master),
      sfx: raw.sfx !== false,
      music: raw.music === true,
      musicVol: clamp(typeof raw.musicVol === "number" ? raw.musicVol : DEFAULT.musicVol),
    };
  } catch {
    return { ...DEFAULT };
  }
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));

// ── world ambient palettes — root + intervals + a character per realm ──────────────────
const WORLDS: Record<WorldSlug, { roots: number[]; type: OscillatorType; cutoff: number; trem: number }> = {
  // throne room — a noble open fifth, warm + calm
  itc: { roots: [65.41, 98.0, 130.81], type: "sine", cutoff: 700, trem: 0.06 },
  // the arena — a low tense pulse + a rubbing minor second, urgent
  competitiva: { roots: [55.0, 58.27, 82.41], type: "sawtooth", cutoff: 480, trem: 0.5 },
  // the forge — a mechanical industrial hum
  fred: { roots: [49.0, 73.42, 98.0], type: "square", cutoff: 360, trem: 0.18 },
  // the cloister — a sober sustained pad, very slow
  aleman: { roots: [61.74, 92.5, 123.47], type: "triangle", cutoff: 560, trem: 0.04 },
};

class Engine {
  private cfg: AudioConfig = load();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambient: { nodes: AudioNode[]; gain: GainNode } | null = null;
  private world: WorldSlug | null = null;
  private listeners = new Set<(c: AudioConfig) => void>();

  getConfig(): AudioConfig {
    return { ...this.cfg };
  }
  subscribe(fn: (c: AudioConfig) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  setConfig(patch: Partial<AudioConfig>) {
    this.cfg = { ...this.cfg, ...patch };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.cfg));
      } catch {
        /* private mode — preference just not persisted */
      }
    }
    if (this.master) this.master.gain.value = this.cfg.master;
    if (this.musicBus) this.musicBus.gain.value = this.cfg.music ? this.cfg.musicVol : 0;
    // re-evaluate ambient on/off
    if (!this.cfg.music) this.stopAmbient();
    else if (this.world && !this.ambient) this.startAmbient(this.world);
    this.listeners.forEach((fn) => fn(this.getConfig()));
  }

  /** Resume the context — MUST be called from a user gesture (iOS). Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.cfg.master;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.cfg.music ? this.cfg.musicVol : 0;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.cfg.music && this.world && !this.ambient) this.startAmbient(this.world);
  }

  // ── SFX — short synthesized envelopes ──────────────────────────────────────────────
  sfx(name: Sfx) {
    if (!this.cfg.sfx || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, peak: number, type: OscillatorType = "sine", endFreq?: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(this.master!);
      o.start(start);
      o.stop(start + dur + 0.02);
    };
    switch (name) {
      case "click":
        tone(660, t, 0.05, 0.12, "sine", 540);
        break;
      case "reveal":
        tone(440, t, 0.4, 0.09, "sine", 660);
        tone(660, t + 0.04, 0.4, 0.06, "sine", 990);
        break;
      case "gate": {
        const chord = [523.25, 659.25, 783.99]; // C5 E5 G5 — a major resolution
        chord.forEach((f, i) => tone(f, t + i * 0.07, 0.5, 0.1, "triangle"));
        break;
      }
      case "xp":
        tone(587.33, t, 0.12, 0.1, "sine", 880); // a rising fifth
        break;
      case "error":
        tone(196, t, 0.28, 0.12, "sawtooth", 110);
        break;
      case "ascension": {
        // a liturgical swell — low drone + a slow rising fifth + a bell
        tone(98, t, 2.1, 0.08, "sine");
        tone(196, t + 0.1, 1.9, 0.06, "sine", 294);
        tone(784, t + 0.5, 1.6, 0.05, "triangle");
        [1046.5, 1318.5].forEach((f, i) => tone(f, t + 0.8 + i * 0.18, 1.0, 0.04, "sine"));
        break;
      }
    }
  }

  // ── ambient drone per world ────────────────────────────────────────────────────────
  setWorld(world: string | null) {
    const w = world && (world in WORLDS) ? (world as WorldSlug) : null;
    this.world = w;
    if (!w) return this.stopAmbient();
    if (!this.cfg.music) return; // music off → stay silent (honest)
    if (!this.ctx) return; // not unlocked yet → will start on unlock
    if (this.ambient) this.crossfadeTo(w);
    else this.startAmbient(w);
  }

  private startAmbient(world: WorldSlug) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const spec = WORLDS[world];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = spec.cutoff;
    // slow LFO on the cutoff so the drone breathes (never tiring)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = spec.trem;
    lfoGain.gain.value = spec.cutoff * 0.4;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const oscs: OscillatorNode[] = spec.roots.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = spec.type;
      o.frequency.value = f * (1 + (i - 1) * 0.004); // slight detune for warmth
      const g = ctx.createGain();
      g.gain.value = 0.14 / spec.roots.length;
      o.connect(g).connect(filter);
      o.start();
      return o;
    });
    filter.connect(out).connect(this.musicBus);
    this.ambient = { nodes: [...oscs, lfo, filter, out], gain: out };
  }

  private crossfadeTo(world: WorldSlug) {
    this.stopAmbient();
    this.startAmbient(world);
  }

  private stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { nodes, gain } = this.ambient;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    } catch {
      /* node may be mid-teardown */
    }
    nodes.forEach((n) => {
      const anyN = n as OscillatorNode;
      if (typeof anyN.stop === "function") {
        try {
          anyN.stop(now + 0.7);
        } catch {
          /* already stopped */
        }
      }
    });
    this.ambient = null;
  }
}

export const audio = new Engine();
