// MEDIA SESSION — lock-screen / notification controls for the audiobook. The Media Session API is
// what lets the OS show play/pause/skip on the lock screen and keep the audio session alive in
// background WHERE THE PLATFORM ALLOWS IT (Android/desktop Chrome: yes, anchored to a playing audio
// element — see audio-anchor.ts; iOS Safari: speechSynthesis is aggressively throttled when the
// screen locks and may still cut — the honest limit, stated in the UI and the report, never faked).
// Testable by dependency injection: every function accepts the MediaSession-like object (defaults
// to navigator.mediaSession). Pure wiring — no state of its own, nothing touches the log.

export interface MediaSessionLike {
  metadata: unknown;
  playbackState?: string;
  setActionHandler(action: string, handler: (() => void) | null): void;
}

export interface AudiobookMediaHooks {
  play: () => void;
  pause: () => void;
  /** section jumps (previoustrack/nexttrack — a section is the audiobook's "track") */
  nextSection: () => void;
  prevSection: () => void;
  /** fine seeks (seekforward/seekbackward — a few sentence-fragments) */
  seekForward: () => void;
  seekBackward: () => void;
}

export interface AudiobookMediaMeta {
  /** the book title (Media Session `title`) */
  title: string;
  /** the current section (Media Session `artist` — the line under the title on the lock screen) */
  section: string;
  /** the spine / world (Media Session `album`) */
  spine: string;
  /** artwork URLs (the PWA icons — already shipped, no new assets) */
  artwork?: { src: string; sizes: string; type: string }[];
}

function defaultSession(): MediaSessionLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { mediaSession?: MediaSessionLike };
  return nav.mediaSession ?? null;
}

export function mediaSessionSupported(ms: MediaSessionLike | null = defaultSession()): boolean {
  return ms !== null && typeof ms.setActionHandler === "function";
}

/** The actions the audiobook binds — one source of truth so bind/unbind can never drift apart. */
export const AUDIOBOOK_ACTIONS = ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward"] as const;

/** Update the lock-screen metadata (book title · current section · spine + artwork). */
export function setAudiobookMetadata(meta: AudiobookMediaMeta, ms: MediaSessionLike | null = defaultSession()): void {
  if (!ms) return;
  try {
    const Ctor = (globalThis as { MediaMetadata?: new (init: Record<string, unknown>) => unknown }).MediaMetadata;
    if (!Ctor) return;
    ms.metadata = new Ctor({
      title: meta.title,
      artist: meta.section,
      album: meta.spine,
      artwork: meta.artwork ?? [],
    });
  } catch {
    // metadata is best-effort chrome — a platform that rejects it must never break playback
  }
}

/** Reflect play/pause on the OS controls. */
export function setAudiobookPlaybackState(state: "playing" | "paused" | "none", ms: MediaSessionLike | null = defaultSession()): void {
  if (!ms) return;
  try {
    ms.playbackState = state;
  } catch {
    // some engines expose playbackState read-only — best-effort
  }
}

/** Bind the audiobook's handlers to the OS controls. Returns the unbind (nulls every handler and
 *  clears metadata/state) — the caller runs it on stop/unmount so a dead reader never keeps
 *  lock-screen buttons alive. */
export function bindAudiobookMediaSession(hooks: AudiobookMediaHooks, ms: MediaSessionLike | null = defaultSession()): () => void {
  if (!mediaSessionSupported(ms)) return () => {};
  const session = ms!;
  const map: Record<(typeof AUDIOBOOK_ACTIONS)[number], () => void> = {
    play: hooks.play,
    pause: hooks.pause,
    previoustrack: hooks.prevSection,
    nexttrack: hooks.nextSection,
    seekbackward: hooks.seekBackward,
    seekforward: hooks.seekForward,
  };
  for (const action of AUDIOBOOK_ACTIONS) {
    try {
      session.setActionHandler(action, map[action]);
    } catch {
      // an engine that doesn't support one action must not lose the rest
    }
  }
  return () => {
    for (const action of AUDIOBOOK_ACTIONS) {
      try {
        session.setActionHandler(action, null);
      } catch {
        /* already gone */
      }
    }
    try {
      session.metadata = null;
      session.playbackState = "none";
    } catch {
      /* best-effort */
    }
  };
}
