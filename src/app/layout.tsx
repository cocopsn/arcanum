import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARCANUM",
  description: "PWA local-first de aprendizaje — aprende por error, aprende por acción.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
