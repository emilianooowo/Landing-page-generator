import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { fontClassNames } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generador de páginas para emprendimientos | LIA",
  description: "Crea una página para tu emprendimiento con solo contarnos tu idea.",
  manifest: "/manifest.json",
  icons: {
    icon: "/web-app-manifest-512x512.png",
    apple: "/web-app-manifest-512x512.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={fontClassNames}>
      <head><meta name="apple-mobile-web-app-title" content="Landing IA" /></head>
      <body className="min-h-screen antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
