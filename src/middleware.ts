import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "admin_key";
const NO_STORE_VALUE = "no-store, max-age=0";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isAssetPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isProtectedPath(pathname)) {
    const adminKey = process.env.ADMIN_KEY ?? process.env.ADMIN_PASSWORD;
    if (adminKey) {
      const cookieValue = request.cookies.get(ADMIN_COOKIE)?.value;
      if (cookieValue !== adminKey) {
        return new NextResponse("Not Found", { status: 404 });
      }
    }
  }

  const response = NextResponse.next();
  if (!isAssetPath(pathname)) {
    response.headers.set("Cache-Control", NO_STORE_VALUE);
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
