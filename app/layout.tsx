import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { fontClassNames } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generador de páginas para emprendimientos | LPG",
  description: "Crea una página para tu emprendimiento con solo contarnos tu idea.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={fontClassNames}>
      <body className="min-h-screen antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
