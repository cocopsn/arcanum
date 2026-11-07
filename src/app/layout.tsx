import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, Chakra_Petch } from "next/font/google";
import { forgeSans, forgeMono } from "@/forge/fonts/plex";
import { HEAD_ICONS } from "@/lib/brand-icons.mjs";
import "./globals.css";

// Cinzel — Trajan imperial caps: the crown, grade names, world titles, the ceremony.
const display = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
// EB Garamond — the grimoire reading voice: mission/lesson/feedback prose, ceremony phrases.
const serif = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});
// Chakra Petch — squared techno/HUD sans (replaces generic Inter): labels, buttons, the
// competitive clock + rating, tabular numerals. Carries the stylized/aggressive Persona edge.
const sans = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARCANUM",
  description:
    "Laboratorio de aprendizaje hermético. Aprende por error, aprende por acción.",
  applicationName: "Arcanum",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Arcanum",
  },
  // the guardian raven (`pnpm icons`); the URLs, with ?v= = sha256[:10] of each file, live in src/lib/brand-icons.mjs
  icons: {
    icon: [
      { url: HEAD_ICONS.favicon, sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: HEAD_ICONS.favicon32, sizes: "32x32", type: "image/png" },
    ],
    apple: HEAD_ICONS.appleTouch,
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0b12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${serif.variable} ${sans.variable} ${forgeSans.variable} ${forgeMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
