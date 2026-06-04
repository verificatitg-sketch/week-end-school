import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WEEK-END SCHOOL DIGITAL — Formation, Paix & Inclusion",
  description:
    "Plateforme numérique de formation, d'inclusion socio-économique et de consolidation de la paix. Former aujourd'hui, autonomiser demain, bâtir la paix pour toujours.",
  keywords: [
    "WEDS",
    "formation",
    "paix",
    "inclusion",
    "Togo",
    "entrepreneuriat",
    "mentorat",
    "e-learning",
  ],
  authors: [{ name: "WEEK-END SCHOOL DIGITAL" }],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/logo.png", type: "image/png", sizes: "256x256" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    title: "WEEK-END SCHOOL DIGITAL",
    description: "Formation, Paix & Inclusion au Togo",
    images: ["/android-chrome-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1D71B8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
