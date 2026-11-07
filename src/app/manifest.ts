import type { MetadataRoute } from "next";
import { MANIFEST_ICONS } from "@/lib/brand-icons.mjs";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcanum",
    short_name: "Arcanum",
    description:
      "Laboratorio de aprendizaje hermético. Aprende por error, aprende por acción.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0b12",
    theme_color: "#0c0b12",
    lang: "es",
    // the guardian raven (`pnpm icons`). The URLs, with ?v= = sha256[:10] of each file, live in src/lib/brand-icons.mjs:
    // Chrome (144+) only re-fetches an installed app's icons when their URL changes.
    icons: [
      { src: MANIFEST_ICONS.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: MANIFEST_ICONS.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: MANIFEST_ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
