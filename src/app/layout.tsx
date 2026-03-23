import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import TimeThemeEffect from "@/components/TimeThemeEffect";
import DebugBanner from "@/components/DebugBanner";
import "./globals.css";

const sfFontBody = localFont({
  src: "../fonts/Roboto-VariableFont_wdth,wght.ttf",
  variable: "--sf-font-body",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

const sfFontDisplay = localFont({
  src: "../fonts/Rubik-VariableFont_wght.ttf",
  variable: "--sf-font-display",
  display: "swap",
  weight: "600 900",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Kincstartó",
  description: "Spirituális könyvtár szűréssel és AI-tervezett bejegyzésekkel",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className={`${sfFontBody.variable} ${sfFontDisplay.variable}`}>
      <body className={`${sfFontBody.className} antialiased`}>
        <TimeThemeEffect />
        <DebugBanner />
        {children}
      </body>
    </html>
  );
}
