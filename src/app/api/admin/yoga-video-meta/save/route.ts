import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { YogaVideoMetaSchema, type YogaVideoMeta } from "@/lib/yogaVideoMetaSchema";
import { readYogaVideoMeta, writeYogaVideoMeta } from "@/lib/yogaVideoMetaStore";

type Payload = {
  item: YogaVideoMeta;
};

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ error: "Invalid payload", detail }, { status });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch (err) {
    return jsonError((err as Error)?.message ?? "Invalid JSON");
  }

  const parsed = YogaVideoMetaSchema.safeParse(payload?.item);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((issue) => issue.message).join(" | "));
  }

  const item = parsed.data;
  const entries = await readYogaVideoMeta();
  const next = entries.filter((entry) => entry.yoga_id !== item.yoga_id);
  next.push(item);

  await writeYogaVideoMeta(next);
  return NextResponse.json({ ok: true });
}
