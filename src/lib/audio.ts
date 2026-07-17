"use client";

// SYSTEM AUDIO — fully SYNTHESIZED via Web Audio (zero asset files, zero cost, zero licence).
// SFX (premium, discreet — not cartoonish) + an ambient drone per WORLD + a device-local config
// (master/sfx/music, persisted to localStorage — a preference, NOT log state). iOS blocks autoplay:
// the context is created suspended and resumed on the first user gesture (unlock). All no-ops on SSR.

export type Sfx =
  | "click"
  | "reveal"
  | "gate"
  | "xp"
  | "error"
  | "ascension"
  // lesson-mode events: a step cleared, a heart lost (tense, not cruel), an insight resolved
  // (a small victory), the lesson completed (liturgical).
  | "step"
  | "heart"
  | "resolve"
  | "lessonwin"
  // ── INTERACTION layer: every gesture answers, and each is recognisable WITHOUT looking.
  // Kept discreet on purpose — these fire constantly, so they must never fatigue.
  | "toggle" // a switch/tab/select flips — a crisp bright tick, shorter than any button
  | "nav" // entering something (a world, a section) — a short forward rise
  | "open" // a sheet/panel opens — a soft rising breath
  | "close" // …and its falling mirror
  | "primary" // a primary action — weighted + confident (low body, bright top)
  | "secondary" // a secondary action — light, unobtrusive
  | "success" // a state landed well (saved, done)
  | "blocked" // sealed / not allowed — a DULL stop; deliberately not the sharp `error` of a wrong answer
  | "saved" // autosave — nearly subliminal, one high tick
  | "import"; // content ingested — a settle onto a low root
export type WorldSlug = "itc" | "fred" | "competitiva" | "aleman";

export interface AudioConfig {
  master: number; // 0..1
  sfx: boolean;
  sfxVol: number; // 0..1 — INDEPENDENT of music
  music: boolean;
  musicVol: number; // 0..1
}

const KEY = "arcanum_audio";
const DEFAULT: AudioConfig = { master: 0.7, sfx: true, sfxVol: 0.8, music: false, musicVol: 0.4 };

function load(): AudioConfig {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      master: clamp(typeof raw.master === "number" ? raw.master : DEFAULT.master),
      sfx: raw.sfx !== false,
      sfxVol: clamp(typeof raw.sfxVol === "number" ? raw.sfxVol : DEFAULT.sfxVol),
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
  private sfxBus: GainNode | null = null;
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
    if (this.sfxBus) this.sfxBus.gain.value = this.cfg.sfx ? this.cfg.sfxVol : 0;
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
      // two independent buses under master: SFX and music each carry their own level, so the
      // learner can keep the interaction feedback and silence the drone (or the reverse).
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.cfg.sfx ? this.cfg.sfxVol : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.cfg.music ? this.cfg.musicVol : 0;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.cfg.music && this.world && !this.ambient) this.startAmbient(this.world);
  }

  /** The gesture entry point: unlock (iOS needs a user gesture) + play, in one call. Every UI
   *  handler uses this so no gesture can ever be wired without also arming the context. */
  cue(name: Sfx) {
    this.unlock();
    this.sfx(name);
  }

  // ── SFX — short synthesized envelopes ──────────────────────────────────────────────
  sfx(name: Sfx) {
    if (!this.cfg.sfx || !this.ctx || !this.master) return; // muted → not a single node is created
    const ctx = this.ctx;
    const bus: AudioNode = this.sfxBus ?? this.master;
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
      o.connect(g).connect(bus);
      o.start(start);
      o.stop(start + dur + 0.02); // self-terminating → the node is released, nothing to clean up
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
      case "step":
        // a clean forward blip — a short rising step (advance)
        tone(523.25, t, 0.09, 0.09, "sine", 659.25);
        break;
      case "heart":
        // a heart lost — a tense, soft descending minor third (not a harsh buzzer; the cost is felt, not punished)
        tone(392, t, 0.16, 0.1, "triangle", 311.13);
        tone(196, t + 0.02, 0.18, 0.05, "sine", 155.56);
        break;
      case "resolve": {
        // the insight lands — a satisfying rising arpeggio (the small victory of understanding)
        [440, 587.33, 880].forEach((f, i) => tone(f, t + i * 0.06, 0.22, 0.09, "triangle"));
        break;
      }
      case "lessonwin": {
        // lesson superada — a brief liturgical resolution (smaller than ascension): a major triad over a low root
        tone(130.81, t, 0.9, 0.07, "sine");
        [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + 0.05 + i * 0.08, 0.7, 0.09, "triangle"));
        tone(1046.5, t + 0.35, 0.6, 0.05, "sine");
        break;
      }

      // ── INTERACTION layer — fires constantly, so: short, quiet, and each one its own shape ──
      case "toggle":
        // a switch flips — one crisp bright tick, the shortest sound in the system
        tone(987.77, t, 0.03, 0.06, "square", 1174.66);
        break;
      case "nav":
        // forward motion into a world/section — a rise with a quiet harmonic above it
        tone(293.66, t, 0.11, 0.075, "triangle", 440);
        tone(587.33, t + 0.03, 0.09, 0.035, "sine", 880);
        break;
      case "open":
        // a sheet breathes in
        tone(349.23, t, 0.16, 0.055, "triangle", 523.25);
        break;
      case "close":
        // …and out — the exact mirror, so the pair reads as one gesture
        tone(523.25, t, 0.14, 0.045, "triangle", 349.23);
        break;
      case "primary":
        // a decision with weight: a low body under a bright top
        tone(130.81, t, 0.13, 0.085, "triangle");
        tone(523.25, t, 0.09, 0.06, "sine", 659.25);
        break;
      case "secondary":
        // a lighter choice — present, never insistent
        tone(493.88, t, 0.05, 0.045, "sine", 466.16);
        break;
      case "success":
        // it landed — a rising major third (smaller than the gate's full triad)
        tone(523.25, t, 0.1, 0.07, "triangle");
        tone(659.25, t + 0.06, 0.16, 0.06, "triangle");
        break;
      case "blocked":
        // sealed: a DULL stop. No pitch drama — the door simply does not move. Deliberately
        // NOT `error` (that one judges an answer; this one only states a boundary).
        tone(110, t, 0.1, 0.1, "square", 103.83);
        tone(82.41, t + 0.05, 0.12, 0.06, "square");
        break;
      case "saved":
        // autosave — nearly subliminal; felt more than heard
        tone(1567.98, t, 0.035, 0.025, "sine");
        break;
      case "import":
        // content ingested — a descent that settles onto a low root
        tone(659.25, t, 0.09, 0.05, "triangle", 523.25);
        tone(196, t + 0.07, 0.22, 0.06, "sine");
        break;
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
