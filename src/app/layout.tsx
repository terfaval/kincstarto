import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
    <html
      lang="hu"
      className={`${sfFontBody.variable} ${sfFontDisplay.variable}`}
      data-preboot="ok"
    >
      <body className={`${sfFontBody.className} antialiased`}>
        <Script
          id="client-error-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  if (typeof window === "undefined") return;
  if (window.__clientErrorBootstrap) return;
  window.__clientErrorBootstrap = true;

  function getSearch() {
    try {
      return window.location && window.location.search ? window.location.search : "";
    } catch (e) {
      return "";
    }
  }

  function isDebug(search) {
    return search && search.indexOf("debug=1") !== -1;
  }

  function setPrebootMarker() {
    try {
      if (document && document.documentElement) {
        document.documentElement.dataset.preboot = "ok";
      }
    } catch (e) {}
  }

  function ensureDebugPanel() {
    try {
      var existing = document.getElementById("preboot-debug");
      if (existing) return existing;
      var div = document.createElement("div");
      div.id = "preboot-debug";
      div.textContent = "preboot";
      div.style.position = "fixed";
      div.style.top = "8px";
      div.style.left = "8px";
      div.style.maxWidth = "90vw";
      div.style.padding = "6px 8px";
      div.style.background = "rgba(180, 40, 40, 0.92)";
      div.style.color = "#fff";
      div.style.fontSize = "12px";
      div.style.borderRadius = "6px";
      div.style.zIndex = "10000";
      div.style.pointerEvents = "none";
      if (document.body) {
        document.body.appendChild(div);
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          if (document.body && !document.getElementById("preboot-debug")) {
            document.body.appendChild(div);
          }
        });
      }
      return div;
    } catch (e) {
      return null;
    }
  }

  function updateDebugPanel(text) {
    try {
      var panel = ensureDebugPanel();
      if (panel) panel.textContent = text;
    } catch (e) {}
  }

  var search = getSearch();
  var debugEnabled = isDebug(search);
  setPrebootMarker();
  if (debugEnabled) {
    try {
      if (document && document.documentElement) {
        document.documentElement.dataset.debug = "1";
      }
      updateDebugPanel("preboot");
    } catch (e) {}
  }

  window.__prebootOk = true;
  window.__bootDiag = {
    ua: navigator && navigator.userAgent ? navigator.userAgent : "unknown",
    path: window.location ? window.location.pathname : "",
    search: search,
    preboot: true,
    clientBoot: Boolean(window.__clientBoot),
    firstMount: window.__firstClientMount ? window.__firstClientMount.app : null
  };

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
      if (debugEnabled) {
        updateDebugPanel(type + ": " + (payload && payload.message ? payload.message : "see logs"));
      }
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

  window.addEventListener("error", function (event) {
    try {
      var target = event.target || event.srcElement;
      if (target && target.tagName && target !== window) {
        report("resourceerror", {
          tag: target.tagName,
          src: target.src || target.href || "",
          id: target.id || "",
          className: target.className || ""
        });
      }
    } catch (e) {}
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    report("unhandledrejection", {
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack
    });
  });
})();
            `,
          }}
        />
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
