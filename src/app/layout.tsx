import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, Chakra_Petch } from "next/font/google";
import { forgeSans, forgeMono } from "@/forge/fonts/plex";
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
  // the guardian raven (`pnpm icons`); ?v= = sha256[:10] of each file, so browsers drop the old icon (brand-icons.test.ts)
  icons: {
    icon: [
      { url: "/favicon.ico?v=746ff5c916", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/favicon-32.png?v=ecfe2855bc", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png?v=bea11a0e15",
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
