import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import TimeThemeEffect from "@/components/TimeThemeEffect";
import ClientBootMarker from "@/components/ClientBootMarker";
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

const DAY_THEME_COLOR = "#efddc6";
const NIGHT_THEME_COLOR = "#0a1324";

export const metadata: Metadata = {
  title: "Kincstartó",
  description: "Spirituális könyvtár szűréssel és AI-tervezett bejegyzésekkel",
  icons: {
    icon: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Kincstartó",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: DAY_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: NIGHT_THEME_COLOR },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hu"
      className={`${sfFontBody.variable} ${sfFontDisplay.variable}`}
      data-preboot="ok"
      suppressHydrationWarning
    >
      <body className={`${sfFontBody.className} antialiased`}>
        <noscript>
          <div
            style={{
              position: "fixed",
              top: "8px",
              left: "8px",
              padding: "6px 8px",
              background: "rgba(180, 40, 40, 0.92)",
              color: "#fff",
              fontSize: "12px",
              borderRadius: "6px",
              zIndex: 10000,
            }}
          >
            {"JS disabled or blocked"}
          </div>
        </noscript>
        <TimeThemeEffect />
        <ClientBootMarker />
        {children}
      </body>
    </html>
  );
}
