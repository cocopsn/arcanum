import type { MetadataRoute } from "next";

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
    // the guardian raven (`pnpm icons`). ?v= = sha256[:10] of each file: Chrome (144+) only re-fetches an installed
    // app's icons when their URL changes (brand-icons.test.ts keeps it in step with the file).
    icons: [
      { src: "/icons/icon-192.png?v=af8f4bcc6d", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=65ebe62da3", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png?v=43190331ca",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
