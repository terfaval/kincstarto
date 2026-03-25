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

  // phase 1: direct DOM marker (no storage/network/query parsing)
  (function () {
    try {
      var doc = document;
      var root = doc && doc.documentElement;
      if (root) {
        root.setAttribute("data-inline-start", "1");
        root.setAttribute("data-inline-phase", "1");
      }
      if (doc) {
        doc.title = "INLINE-START " + (doc.title || "");
      }
      var badge = doc && doc.getElementById("inline-phase-badge");
      if (!badge && doc) {
        badge = doc.createElement("div");
        badge.id = "inline-phase-badge";
        badge.style.position = "fixed";
        badge.style.top = "32px";
        badge.style.left = "8px";
        badge.style.padding = "4px 6px";
        badge.style.background = "rgba(30, 30, 30, 0.85)";
        badge.style.color = "#fff";
        badge.style.fontSize = "11px";
        badge.style.borderRadius = "6px";
        badge.style.zIndex = "10001";
        badge.style.pointerEvents = "none";
        if (doc.body) {
          doc.body.appendChild(badge);
        } else {
          doc.addEventListener("DOMContentLoaded", function () {
            if (doc.body && !doc.getElementById("inline-phase-badge")) {
              doc.body.appendChild(badge);
            }
          });
        }
      }
      if (badge) {
        badge.textContent = "inline-1";
      }
    } catch (e) {}
  })();

  if (window.__clientErrorBootstrap) return;
  window.__clientErrorBootstrap = true;

  var debugEnabled = false;

  // phase 2: minimal debug param check
  (function () {
    try {
      debugEnabled = !!(
        window.location &&
        window.location.search &&
        window.location.search.indexOf("debug=1") !== -1
      );
      var doc = document;
      var root = doc && doc.documentElement;
      if (root) {
        root.setAttribute("data-inline-phase", "2");
      }
      var badge = doc && doc.getElementById("inline-phase-badge");
      if (badge) {
        badge.textContent = "inline-2";
      }
    } catch (e) {}
  })();

  function setPrebootMarker() {
    try {
      if (document && document.documentElement) {
        document.documentElement.dataset.preboot = "ok";
      }
    } catch (e) {}
  }

  function insertPrebootDiv(enabled) {
    if (!enabled) return;
    try {
      if (document.getElementById("preboot-debug")) return;
      var div = document.createElement("div");
      div.id = "preboot-debug";
      div.textContent = "preboot";
      div.style.position = "fixed";
      div.style.top = "8px";
      div.style.left = "8px";
      div.style.padding = "6px 8px";
      div.style.background = "rgba(180, 40, 40, 0.85)";
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
    } catch (e) {}
  }

  setPrebootMarker();
  if (debugEnabled) {
    try {
      if (document && document.documentElement) {
        document.documentElement.dataset.debug = "1";
      }
    } catch (e) {}
  }
  insertPrebootDiv(debugEnabled);

  // phase 3: install error listeners
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

  var listenersInstalled = false;
  try {
    window.addEventListener("error", function (event) {
      report("error", {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error && event.error.stack
      });
    });

    window.addEventListener(
      "error",
      function (event) {
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
      },
      true
    );

    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason;
      report("unhandledrejection", {
        message: reason && reason.message ? reason.message : String(reason),
        stack: reason && reason.stack
      });
    });

    listenersInstalled = true;
  } catch (e) {}

  if (listenersInstalled) {
    try {
      var doc = document;
      var root = doc && doc.documentElement;
      if (root) {
        root.setAttribute("data-inline-phase", "3");
      }
      var badge = doc && doc.getElementById("inline-phase-badge");
      if (badge) {
        badge.textContent = "inline-3";
      }
    } catch (e) {}
  }

  // phase 4: richer diagnostics
  try {
    window.__prebootOk = true;
    window.__bootDiag = {
      ua: navigator && navigator.userAgent ? navigator.userAgent : "unknown",
      path: window.location ? window.location.pathname : "",
      search: window.location ? window.location.search : "",
      preboot: true,
      clientBoot: Boolean(window.__clientBoot),
      firstMount: window.__firstClientMount ? window.__firstClientMount.app : null
    };

    if (debugEnabled && window && window.console && window.console.log) {
      try {
        console.log("[preboot] ua=" + window.__bootDiag.ua);
        console.log("[preboot] path=" + window.__bootDiag.path + " search=" + window.__bootDiag.search);
        console.log("[preboot] preboot=" + window.__bootDiag.preboot + " clientBoot=" + window.__bootDiag.clientBoot);
      } catch (e) {}
    }

    var doc = document;
    var root = doc && doc.documentElement;
    if (root) {
      root.setAttribute("data-inline-phase", "ok");
    }
    var badge = doc && doc.getElementById("inline-phase-badge");
    if (badge) {
      badge.textContent = "inline-ok";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hu"
      className={`${sfFontBody.variable} ${sfFontDisplay.variable}`}
    >
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
