"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// PWA/mobile vs DESKTOP layout. The mobile-first design fills an iPhone perfectly but wastes a wide
// screen. This picks a default from the CONTEXT (installed PWA / viewport width) and lets the user
// OVERRIDE it with a toggle, persisted DEVICE-LOCAL (never the log). It reflects the mode on
// <html data-layout> so plain CSS can respond app-wide, and exposes it to components that reflow
// structurally (a cell detail becomes a side panel, the home becomes a wide grid). Same logic + same
// aesthetic in both — only the layout/density changes.

export type LayoutMode = "pwa" | "desktop";
const KEY = "arcanum_layout";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}
function autoDetect(): LayoutMode {
  if (typeof window === "undefined") return "pwa";
  if (isStandalone()) return "pwa"; // installed PWA → the mobile-first design is the right one
  return window.innerWidth >= 1024 ? "desktop" : "pwa";
}
function readOverride(): LayoutMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === "pwa" || v === "desktop" ? v : null;
  } catch {
    return null;
  }
}

interface Ctx {
  mode: LayoutMode;
  override: LayoutMode | null;
  setMode: (m: LayoutMode | null) => void;
}
const LayoutCtx = createContext<Ctx>({ mode: "pwa", override: null, setMode: () => {} });
export function useLayoutMode(): Ctx {
  return useContext(LayoutCtx);
}

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<LayoutMode | null>(null);
  const [auto, setAuto] = useState<LayoutMode>("pwa");

  useEffect(() => {
    setOverride(readOverride());
    const recompute = () => setAuto(autoDetect());
    recompute();
    window.addEventListener("resize", recompute);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      mq?.removeEventListener?.("change", recompute);
    };
  }, []);

  const mode = override ?? auto;

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-layout", mode);
  }, [mode]);

  const setMode = useCallback((m: LayoutMode | null) => {
    setOverride(m);
    try {
      if (m) localStorage.setItem(KEY, m);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode — preference just not persisted */
    }
  }, []);

  return <LayoutCtx.Provider value={{ mode, override, setMode }}>{children}</LayoutCtx.Provider>;
}
