"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechItem } from "@/lib/book-speech";

// The audiobook ENGINE — the browser's Web Speech API (speechSynthesis). It uses the VOICES INSTALLED ON THE
// DEVICE, so it is 100% OFFLINE, zero cost, zero API key (on iOS the system es-MX/es-ES voices apply). We
// speak ONE utterance at a time (advance on `onend`) rather than queueing the whole book, because that gives
// clean pause/resume/skip and lets each item carry its own pitch/rate (a heading is intoned differently from
// prose). iOS blocks speech until a user gesture — `play()` is called from the button tap, which satisfies it;
// the voice list can also arrive asynchronously (`voiceschanged`), which we listen for. Nothing here fetches.

export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

/** Only Spanish voices (es-*), the ones worth offering the learner. */
export function spanishVoices(voices: VoiceInfo[]): VoiceInfo[] {
  return voices.filter((v) => /^es(\b|[-_])/i.test(v.lang));
}

/** Choose the voice: an explicit pick wins; else the best Spanish (es-MX > es-419 > es-ES > es-*), preferring
 *  a local/offline voice; else the first available. PURE + deterministic. */
export function pickVoice(voices: VoiceInfo[], preferredURI?: string | null): VoiceInfo | null {
  if (!voices.length) return null;
  if (preferredURI) {
    const exact = voices.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  const score = (v: VoiceInfo) => {
    const lang = v.lang.replace("_", "-").toLowerCase();
    if (lang.startsWith("es-mx")) return 4;
    if (lang.startsWith("es-419")) return 3.5;
    if (lang.startsWith("es-us")) return 3;
    if (lang.startsWith("es-es")) return 2;
    if (lang.startsWith("es")) return 1;
    return 0;
  };
  const sorted = [...voices].sort((a, b) => score(b) - score(a) || (b.localService ? 1 : 0) - (a.localService ? 1 : 0));
  return sorted[0] ?? null;
}

function toInfo(v: SpeechSynthesisVoice): VoiceInfo {
  return { name: v.name, lang: v.lang, voiceURI: v.voiceURI, localService: v.localService };
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Load the device's voices (now + on the async voiceschanged), for the config voice picker. */
export function useVoices(): VoiceInfo[] {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  useEffect(() => {
    if (!speechSupported()) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices().map(toInfo));
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  return voices;
}

export interface BookSpeechState {
  supported: boolean;
  playing: boolean;
  index: number;
  sectionId: string | null;
  voices: VoiceInfo[];
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  /** jump to a specific item index (used to resume from saved listening progress) */
  goTo: (index: number) => void;
}

/** Drive the audiobook. `items` is the preprocessed script (lib/book-speech). `rate`/`voiceURI` come from the
 *  audio config; a rate change while playing re-speaks the current item (the API can't retune a live one). */
export function useBookSpeech(
  items: SpeechItem[],
  opts: { rate: number; voiceURI: string | null; onIndex?: (index: number) => void; onEnd?: () => void },
): BookSpeechState {
  const supported = speechSupported();
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);

  const itemsRef = useRef(items);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(opts.rate);
  const voiceRef = useRef(opts.voiceURI);
  const voicesRef = useRef<VoiceInfo[]>([]);
  const onIndexRef = useRef(opts.onIndex);
  const onEndRef = useRef(opts.onEnd);
  itemsRef.current = items;
  rateRef.current = opts.rate;
  voiceRef.current = opts.voiceURI;
  onIndexRef.current = opts.onIndex;
  onEndRef.current = opts.onEnd;

  // ── voices: load now + on the async voiceschanged event ──
  useEffect(() => {
    if (!supported) return;
    const refresh = () => {
      const list = window.speechSynthesis.getVoices().map(toInfo);
      voicesRef.current = list;
      setVoices(list);
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [supported]);

  const speakFrom = useCallback(
    (i: number) => {
      if (!supported) return;
      const script = itemsRef.current;
      window.speechSynthesis.cancel();
      if (i < 0 || i >= script.length) {
        playingRef.current = false;
        setPlaying(false);
        onEndRef.current?.();
        return;
      }
      idxRef.current = i;
      setIndex(i);
      onIndexRef.current?.(i);
      const item = script[i]!;
      const u = new SpeechSynthesisUtterance(item.text);
      const voice = pickVoice(voicesRef.current, voiceRef.current);
      if (voice) {
        const real = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voice.voiceURI);
        if (real) u.voice = real;
        u.lang = voice.lang;
      } else {
        u.lang = "es-MX";
      }
      // a heading is intoned higher + a touch slower; a code/table note is lower + a touch faster (an aside)
      u.rate = Math.max(0.5, Math.min(2, rateRef.current * (item.kind === "title" ? 0.95 : item.kind === "note" ? 1.05 : 1)));
      u.pitch = item.kind === "title" ? 1.12 : item.kind === "note" ? 0.9 : 1;
      u.onend = () => {
        if (playingRef.current && idxRef.current === i) speakFrom(i + 1);
      };
      u.onerror = (e) => {
        // a canceled utterance fires onerror with 'canceled'/'interrupted' — that's us, not a failure
        if (e.error !== "canceled" && e.error !== "interrupted") {
          playingRef.current = false;
          setPlaying(false);
        }
      };
      window.speechSynthesis.speak(u);
    },
    [supported],
  );

  const play = useCallback(() => {
    if (!supported) return;
    playingRef.current = true;
    setPlaying(true);
    // resume() covers a browser-level pause; but we always (re)start the current item so iOS reliably speaks
    speakFrom(idxRef.current);
  }, [supported, speakFrom]);

  const pause = useCallback(() => {
    if (!supported) return;
    playingRef.current = false;
    setPlaying(false);
    window.speechSynthesis.cancel(); // keep idxRef → play() resumes from the current item
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    playingRef.current = false;
    setPlaying(false);
    idxRef.current = 0;
    setIndex(0);
    window.speechSynthesis.cancel();
  }, [supported]);

  const sectionOf = (i: number) => itemsRef.current[i]?.sectionId ?? null;
  const jumpSection = useCallback(
    (dir: 1 | -1) => {
      const script = itemsRef.current;
      const cur = sectionOf(idxRef.current);
      let i = idxRef.current;
      if (dir === 1) {
        while (i < script.length && script[i]!.sectionId === cur) i++;
      } else {
        // back to the start of the current section; if already there, to the previous section's start
        while (i > 0 && script[i - 1]!.sectionId === cur) i--;
        if (i === idxRef.current) {
          i--;
          const prevSec = sectionOf(i);
          while (i > 0 && script[i - 1]!.sectionId === prevSec) i--;
        }
      }
      i = Math.max(0, Math.min(script.length - 1, i));
      if (playingRef.current) speakFrom(i);
      else {
        idxRef.current = i;
        setIndex(i);
        onIndexRef.current?.(i);
      }
    },
    [speakFrom],
  );

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(itemsRef.current.length - 1, i));
      idxRef.current = clamped;
      setIndex(clamped);
      if (playingRef.current) speakFrom(clamped);
    },
    [speakFrom],
  );

  // a live rate change re-speaks the current item at the new rate (Web Speech can't retune an in-flight one)
  useEffect(() => {
    if (playingRef.current) speakFrom(idxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.rate, opts.voiceURI]);

  // stop cleanly on unmount (leaving the reader must not leave a voice talking)
  useEffect(() => {
    return () => {
      if (supported) {
        playingRef.current = false;
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    supported,
    playing,
    index,
    sectionId: items[index]?.sectionId ?? null,
    voices,
    play,
    pause,
    stop,
    next: () => jumpSection(1),
    prev: () => jumpSection(-1),
    goTo,
  };
}
