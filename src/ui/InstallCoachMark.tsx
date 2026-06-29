"use client";

import { useEffect, useState } from "react";

const KEY = "arcanum_install_dismissed";

/** iOS has no beforeinstallprompt — show the manual Add-to-Home gesture. */
export function InstallCoachMark() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const standalone =
      (window.navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = window.localStorage.getItem(KEY) === "1";
    if (isSafari && !standalone && !dismissed) setShow(true);
  }, []);

  if (!show) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-[var(--r-md)] border border-line bg-surface-raised px-4 py-3 text-sm text-text-muted"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <span className="flex-1">
        Instala Arcanum: toca{" "}
        <span className="text-text">Compartir</span> y luego{" "}
        <span className="text-text">Agregar a inicio</span>.
      </span>
      <button
        aria-label="Descartar"
        className="min-h-11 min-w-11 text-text-faint hover:text-text"
        onClick={() => {
          window.localStorage.setItem(KEY, "1");
          setShow(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
