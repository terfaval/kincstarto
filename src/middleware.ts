import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "admin_key";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const adminKey = process.env.ADMIN_KEY ?? process.env.ADMIN_PASSWORD;
  if (!adminKey) return NextResponse.next();

  const cookieValue = request.cookies.get(ADMIN_COOKIE)?.value;
  if (cookieValue === adminKey) return NextResponse.next();

  return new NextResponse("Not Found", { status: 404 });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
