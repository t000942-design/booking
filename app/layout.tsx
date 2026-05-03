import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { branding } from "@/lib/config/branding";
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
  title: `${branding.pitchName} · Book the pitch`,
  description: `${branding.tagline} — book a 60-minute slot at ${branding.pitchName}, ${branding.location}.`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
