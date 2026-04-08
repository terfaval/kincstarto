import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.error("[client-error]", JSON.stringify(payload));
  } catch (error) {
    console.error("[client-error] invalid payload", error);
  }
  return new Response(null, { status: 204 });
}
