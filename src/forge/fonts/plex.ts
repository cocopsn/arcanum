import localFont from "next/font/local";

// Engineering Forge fonts (design §14.3): IBM Plex Sans 300/400/500/600 and Mono 400/500, latin subset, unmodified
// (OFL-1.1, see SOURCES.md). next/font/local emits exactly one file per family and weight; no preload, so the
// other worlds never download them up front. The calls live HERE (not in layout.tsx) so the chunk map can tell the
// Forge fonts from the three next/font/google families (§6.7).
export const forgeSans = localFont({
  src: [
    { path: "./ibm-plex-sans-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-forge-sans",
  display: "swap",
  preload: false,
});

export const forgeMono = localFont({
  src: [
    { path: "./ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-forge-mono",
  display: "swap",
  preload: false,
});
