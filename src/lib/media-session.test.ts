import { describe, it, expect, vi } from "vitest";
import {
  AUDIOBOOK_ACTIONS,
  bindAudiobookMediaSession,
  mediaSessionSupported,
  setAudiobookMetadata,
  setAudiobookPlaybackState,
  type MediaSessionLike,
} from "@/lib/media-session";
import { buildSilentWavDataUri } from "@/lib/audio-anchor";

// Media Session wiring — structural proof (the lock screen itself can only be validated on the
// user's phone; what CAN be proven here: every audiobook action binds, unbind clears everything,
// metadata maps the right fields, and a platform without the API degrades to a clean no-op).

function fakeSession() {
  const handlers = new Map<string, (() => void) | null>();
  const ms: MediaSessionLike = {
    metadata: null,
    playbackState: "none",
    setActionHandler: (action, handler) => {
      handlers.set(action, handler);
    },
  };
  return { ms, handlers };
}

const HOOKS = () => ({
  play: vi.fn(),
  pause: vi.fn(),
  nextSection: vi.fn(),
  prevSection: vi.fn(),
  seekForward: vi.fn(),
  seekBackward: vi.fn(),
});

describe("media-session — audiobook lock-screen wiring", () => {
  it("binds ALL six audiobook actions (play/pause, section skips, fine seeks) to the right hooks", () => {
    const { ms, handlers } = fakeSession();
    const hooks = HOOKS();
    bindAudiobookMediaSession(hooks, ms);
    expect([...handlers.keys()].sort()).toEqual([...AUDIOBOOK_ACTIONS].sort());
    handlers.get("play")!!();
    handlers.get("pause")!!();
    handlers.get("nexttrack")!!();
    handlers.get("previoustrack")!!();
    handlers.get("seekforward")!!();
    handlers.get("seekbackward")!!();
    expect(hooks.play).toHaveBeenCalledOnce();
    expect(hooks.pause).toHaveBeenCalledOnce();
    expect(hooks.nextSection).toHaveBeenCalledOnce();
    expect(hooks.prevSection).toHaveBeenCalledOnce();
    expect(hooks.seekForward).toHaveBeenCalledOnce();
    expect(hooks.seekBackward).toHaveBeenCalledOnce();
  });

  it("unbind clears EVERY handler and resets metadata/state — a closed reader leaves no live controls", () => {
    const { ms, handlers } = fakeSession();
    const unbind = bindAudiobookMediaSession(HOOKS(), ms);
    unbind();
    for (const action of AUDIOBOOK_ACTIONS) expect(handlers.get(action)).toBeNull();
    expect(ms.metadata).toBeNull();
    expect(ms.playbackState).toBe("none");
  });

  it("metadata maps book title → title, section → artist, spine → album (what the lock screen shows)", () => {
    const { ms } = fakeSession();
    const Ctor = vi.fn(function (this: Record<string, unknown>, init: Record<string, unknown>) {
      Object.assign(this, init);
    });
    (globalThis as Record<string, unknown>).MediaMetadata = Ctor;
    try {
      setAudiobookMetadata({ title: "Fundamentos", section: "Prólogo", spine: "OA Amazon", artwork: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] }, ms);
      expect(Ctor).toHaveBeenCalledWith(expect.objectContaining({ title: "Fundamentos", artist: "Prólogo", album: "OA Amazon" }));
      expect(ms.metadata).toBeTruthy();
    } finally {
      delete (globalThis as Record<string, unknown>).MediaMetadata;
    }
  });

  it("playback state flows through, and a missing API is a clean no-op (unsupported → noop unbind)", () => {
    const { ms } = fakeSession();
    setAudiobookPlaybackState("playing", ms);
    expect(ms.playbackState).toBe("playing");
    expect(mediaSessionSupported(null)).toBe(false);
    expect(() => bindAudiobookMediaSession(HOOKS(), null)()).not.toThrow();
    expect(() => setAudiobookMetadata({ title: "x", section: "y", spine: "z" }, null)).not.toThrow();
  });
});

describe("audio-anchor — the synthesized silent WAV (zero asset files)", () => {
  it("builds a valid RIFF/WAVE data URI with the exact byte math (44-byte header + 16-bit mono samples)", () => {
    const uri = buildSilentWavDataUri(1, 8000);
    expect(uri.startsWith("data:audio/wav;base64,")).toBe(true);
    const bytes = Uint8Array.from(atob(uri.slice("data:audio/wav;base64,".length)), (c) => c.charCodeAt(0));
    expect(bytes.length).toBe(44 + 8000 * 2);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe("data");
    // every sample is SILENCE — the anchor must never make audible sound
    expect(bytes.slice(44).every((b) => b === 0)).toBe(true);
  });

  it("scales with duration and never emits zero samples", () => {
    const half = buildSilentWavDataUri(0.5, 8000);
    const bytes = Uint8Array.from(atob(half.slice("data:audio/wav;base64,".length)), (c) => c.charCodeAt(0));
    expect(bytes.length).toBe(44 + 4000 * 2);
    const tiny = buildSilentWavDataUri(0, 8000); // clamped to ≥1 sample
    expect(tiny.length).toBeGreaterThan("data:audio/wav;base64,".length);
  });
});
