// AUDIO ANCHOR — a silent, looping <audio> element that holds the OS AUDIO FOCUS while the
// audiobook speaks. Web Speech has no media element, so without an anchor the OS shows no
// lock-screen controls and reclaims the audio session on background (speech dies with the screen).
// The anchor is a tiny PCM WAV **built in code at runtime** — zero asset files, zero licence, same
// synthesized-only rule as every other Arcanum sound. It is nearly-silent (silence samples; tiny
// volume only because some platforms ignore volume-0 elements for focus). Device-local chrome —
// never the log, never mastery. Honest limits: Android/desktop keep speech alive in background;
// iOS may still throttle speechSynthesis on lock — the UI says so instead of pretending.

/** Build a data: URI of a mono 16-bit PCM WAV of pure silence. PURE — byte math only. */
export function buildSilentWavDataUri(seconds = 1, sampleRate = 8000): string {
  const numSamples = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = numSamples * 2; // 16-bit mono
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // samples stay 0 — silence
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/** The runtime anchor. start() must be called from a user gesture (the play tap qualifies). */
export class AudioAnchor {
  private el: HTMLAudioElement | null = null;

  /** Create (once) + play the silent loop. Returns whether the anchor is actually playing. */
  async start(): Promise<boolean> {
    if (typeof document === "undefined") return false;
    if (!this.el) {
      const el = document.createElement("audio");
      el.src = buildSilentWavDataUri(1);
      el.loop = true;
      el.volume = 0.01; // effectively silent (the samples ARE silence); >0 so focus counts everywhere
      el.setAttribute("playsinline", "true");
      el.style.display = "none";
      document.body.appendChild(el);
      this.el = el;
    }
    try {
      await this.el.play();
      return true;
    } catch {
      // autoplay refusal (no gesture yet) — honest false; the caller simply has no lock-screen anchor
      return false;
    }
  }

  /** Pause but KEEP the element — the lock screen keeps showing (paused) controls. */
  hold(): void {
    this.el?.pause();
  }

  /** Tear down completely (stop/unmount): no dead reader may keep an audio session alive. */
  stop(): void {
    if (this.el) {
      this.el.pause();
      this.el.remove();
      this.el = null;
    }
  }
}
