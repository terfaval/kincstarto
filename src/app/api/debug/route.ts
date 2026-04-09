import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const headers = request.headers;
  const safeHeaders: Record<string, string> = {};
  const allowList = [
    "user-agent",
    "accept",
    "accept-language",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-vercel-id",
    "x-vercel-ip-city",
    "x-vercel-ip-country",
    "x-vercel-ip-region",
  ];

  for (const key of allowList) {
    const value = headers.get(key);
    if (value) safeHeaders[key] = value;
  }

  return Response.json({
    ok: true,
    now: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    host: headers.get("host"),
    url: request.nextUrl?.toString(),
    headers: safeHeaders,
  });
}
