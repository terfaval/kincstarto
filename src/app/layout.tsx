import type { Metadata, Viewport } from "next";
import Script from "next/script";
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

const CLIENT_ERROR_BOOTSTRAP = `
(function () {
  if (typeof window === "undefined") return;
  if (window.__clientErrorBootstrap) return;
  window.__clientErrorBootstrap = true;

  function report(type, payload) {
    try {
      if (!window.__firstClientError) {
        window.__firstClientError = { type: type, payload: payload, ts: new Date().toISOString() };
      }
      var body = JSON.stringify({
        type: type,
        payload: payload,
        ts: new Date().toISOString(),
        ua: navigator.userAgent
      });
      try {
        sessionStorage.setItem("first_client_error", body);
      } catch (e) {}
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/client-error", blob);
      } else {
        fetch("/api/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        });
      }
    } catch (e) {}
  }

  window.addEventListener("error", function (event) {
    report("error", {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    report("unhandledrejection", {
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack
    });
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className={`${sfFontBody.variable} ${sfFontDisplay.variable}`}>
      <body className={`${sfFontBody.className} antialiased`}>
        <Script id="client-error-bootstrap" strategy="beforeInteractive">
          {CLIENT_ERROR_BOOTSTRAP}
        </Script>
        <TimeThemeEffect />
        <DebugBanner />
        {children}
      </body>
    </html>
  );
}
