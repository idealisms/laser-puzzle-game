import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SettingsProvider } from "@/context/SettingsContext";
import { MigrationImport } from "@/components/MigrationImport";
import { SITE_URL } from "@/lib/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Laser Puzzle – a free daily mirror logic game",
    template: "%s – Laser Puzzle",
  },
  description:
    "A free daily logic puzzle: place mirrors to bend a laser into the longest path you can. A new puzzle every day, with splitters, one-way gates and portals.",
  applicationName: "Laser Puzzle",
  openGraph: { siteName: "Laser Puzzle", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white min-h-svh`}
      >
        <MigrationImport />
        <SettingsProvider>{children}</SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
