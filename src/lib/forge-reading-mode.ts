"use client";
// Device preferences of Engineering Forge's reader and Atlas (design §14.1, §14.2). Stored in localStorage
// (never in the log): the light/dark reading mode and the greyscale-figures switch. try/catch because Safari can
// throw on storage access; the `storage` event keeps the reader and the Atlas in step across tabs, and a custom
// event does it inside the same tab.
import { useCallback, useEffect, useState } from "react";

export type ForgeReadingMode = "claro" | "oscuro";
export type ForgeFigureMode = "gris" | "color";

export const FORGE_READING_KEY = "arcanum_forge_lectura";
export const FORGE_FIGURE_KEY = "arcanum_forge_figuras";
const SAME_TAB_EVENT = "arcanum-forge-pref";

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, quota): the choice lives only in this render
  }
  try {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key } }));
  } catch {
    // no window (SSR) — nothing to notify
  }
}

function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(readPref(key, allowed, fallback));
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) setValue(readPref(key, allowed, fallback));
    };
    const onSameTab = (e: Event) => {
      const k = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (k === key) setValue(readPref(key, allowed, fallback));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab);
    };
    // allowed and fallback are module constants at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      writePref(key, v);
    },
    [key],
  );
  return [value, set];
}

const READING_MODES = ["claro", "oscuro"] as const;
const FIGURE_MODES = ["gris", "color"] as const;

/** «Lectura clara / oscura»: default "oscuro". */
export function useForgeReadingMode(): [ForgeReadingMode, (m: ForgeReadingMode) => void] {
  return usePref<ForgeReadingMode>(FORGE_READING_KEY, READING_MODES, "oscuro");
}

/** «Figuras en escala de grises»: default "color" (third-party figures keep their colour unless chosen). */
export function useForgeFigureMode(): [ForgeFigureMode, (m: ForgeFigureMode) => void] {
  return usePref<ForgeFigureMode>(FORGE_FIGURE_KEY, FIGURE_MODES, "color");
}
