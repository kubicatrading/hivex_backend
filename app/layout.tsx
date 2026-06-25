import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HIVEX | SaaS Premium de Gestión Documental",
  description: "Plataforma SaaS de última generación con autenticación integrada, analíticas de gráficos interactivos, reproductores premium de audio y videoteca avanzada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-zinc-950 text-zinc-100 flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
