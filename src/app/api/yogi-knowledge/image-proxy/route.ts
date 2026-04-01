import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "public.blob.vercel-storage.com",
  "vercel-storage.com",
]);

function isAllowedHost(hostname: string) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return hostname.endsWith(".public.blob.vercel-storage.com");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  const upstream = await fetch(target.toString(), { method: "GET" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/png";
  const cacheControl =
    upstream.headers.get("cache-control") ?? "public, max-age=31536000, immutable";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}
