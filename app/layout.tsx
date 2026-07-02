import type { Metadata } from "next";
import { Inter, Syncopate, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const syncopate = Syncopate({
  variable: "--font-logo",
  weight: "700",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HIVEX | Premium Document Management SaaS",
  description: "Next-generation SaaS platform with integrated authentication, interactive charts analytics, premium audio players, and an advanced video library.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} ${syncopate.variable} ${cormorantGaramond.variable} min-h-full bg-background text-foreground flex flex-col`}>
        {children}
      </body>
    </html>
  );
}

