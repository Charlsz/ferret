import type { Metadata, Viewport } from "next";
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
  title: {
    template: "%s | Ferret AI",
    default: "Ferret AI - Deep Local Coding Assistant",
  },
  description: "A private, 100% local AI coding assistant running entirely in your browser using WebLLM. No cloud telemetry, no data leaves your machine.",
  keywords: ["AI Assistant", "WebLLM", "Local AI", "Coding Assistant", "Developer Tools", "Privacy", "Secure Coding", "IndexedDB", "WASM", "Browser AI"],
  authors: [{ name: "Ferret" }],
  creator: "Ferret AI",
  openGraph: {
    title: "Ferret AI - Deep Local Coding Assistant",
    description: "A private, 100% local AI coding assistant running entirely in your browser. Complete privacy with zero remote telemetry.",
    siteName: "Ferret AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ferret AI - Deep Local Coding Assistant",
    description: "Private, local AI coding assistant running completely in your browser.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
