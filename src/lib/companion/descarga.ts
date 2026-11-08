// Descarga de un artefacto del compañero (design §16.4). En iOS con la app instalada y con Web Share de archivos,
// usa navigator.share({ files }); si no, un <a download> con un blob: que se revoca a los 10 s; si el navegador no
// soporta download ni share, abre el blob: en pestaña nueva. Un AbortError de share (el aprendiz canceló) no muestra
// nada. Detecta cada API antes de usarla (§3.4): en Node/SSR no hace nada.

function esStandalone(): boolean {
  if (typeof navigator !== "undefined" && (navigator as unknown as { standalone?: boolean }).standalone) return true;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(display-mode: standalone)").matches;
    } catch {
      return false;
    }
  }
  return false;
}

/** Descarga un Blob con el nombre dado. Devuelve cómo se entregó, para pruebas. */
export async function descargar(blob: Blob, nombre: string): Promise<"compartido" | "cancelado" | "descargado" | "pestaña" | "no-disponible"> {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return "no-disponible";

  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> }) : undefined;
  if (esStandalone() && nav?.canShare && typeof File !== "undefined") {
    const archivo = new File([blob], nombre, { type: blob.type });
    if (nav.canShare({ files: [archivo] }) && nav.share) {
      try {
        await nav.share({ files: [archivo] });
        return "compartido";
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return "cancelado";
        // si share falla por otra razón, caemos al <a download>
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  if ("download" in a) {
    a.href = url;
    a.download = nombre;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "descargado";
  }
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "pestaña";
  }
  URL.revokeObjectURL(url);
  return "no-disponible";
}

/** Nombre de archivo con marca de tiempo: `prefijo-AAAAMMDD-HHMM.ext`. */
export function nombreArtefacto(prefijo: string, ext: string, fecha: Date = new Date()): string {
  const z = (n: number, w = 2) => String(n).padStart(w, "0");
  const sello = `${fecha.getFullYear()}${z(fecha.getMonth() + 1)}${z(fecha.getDate())}-${z(fecha.getHours())}${z(fecha.getMinutes())}`;
  return `${prefijo}-${sello}.${ext}`;
}
