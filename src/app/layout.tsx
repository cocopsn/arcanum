import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, Chakra_Petch } from "next/font/google";
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
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
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
      className={`${display.variable} ${serif.variable} ${sans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
