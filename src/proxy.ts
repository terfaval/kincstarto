import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSecret,
  isSameOriginMutation,
  verifyAdminSession,
} from "@/lib/adminSession";

const NO_STORE_VALUE = "private, no-store, max-age=0";

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAdminPage(pathname: string) {
  return matchesPrefix(pathname, "/admin");
}

function isRestrictedPath(pathname: string) {
  return [
    "/admin", "/yogis-choice", "/api/admin", "/api/yogi-knowledge",
    "/api/yogis-choice", "/api/activity-logs", "/api/yoga-templates",
    "/api/strength-progress", "/api/debug",
  ].some((prefix) => matchesPrefix(pathname, prefix));
}

function isAssetPath(pathname: string) {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedRoute = isRestrictedPath(pathname);
  if (protectedRoute) {
    const secret = getAdminSecret();
    const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!verifyAdminSession(session, secret)) {
      if (isAdminPage(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        const response = NextResponse.redirect(url);
        response.headers.set("Cache-Control", NO_STORE_VALUE);
        return response;
      }
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : new NextResponse("Not Found", { status: 404 });
      response.headers.set("Cache-Control", NO_STORE_VALUE);
      return response;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && !isSameOriginMutation(request)) {
      const response = NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
      response.headers.set("Cache-Control", NO_STORE_VALUE);
      return response;
    }
  }

  const response = NextResponse.next();
  if (protectedRoute || !isAssetPath(pathname)) {
    response.headers.set("Cache-Control", NO_STORE_VALUE);
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
