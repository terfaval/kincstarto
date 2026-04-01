import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/adminAuth";
import { YogaVideoStyleEnum } from "@/lib/yogaVideoMetaSchema";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";

export const runtime = "nodejs";

type Payload = {
  yoga_id: string;
  title: string;
  category: string;
  duration_minutes?: number | null;
  intensity?: number | null;
  link?: string | null;
  channel?: string | null;
  source_description?: string | null;
  pose_ids?: string[] | null;
};

type DraftResponse = {
  draft: {
    description_short: string;
    description_long: string;
    style: (typeof YogaVideoStyleEnum.options)[number];
    channel: string | null;
  };
  warnings: string[];
};

function jsonError(phase: string, detail: string, status = 400) {
  return NextResponse.json({ error: "Draft failed", phase, detail }, { status });
}

function getOutputText(response: any) {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const items = Array.isArray(response?.output) ? response.output : [];
  for (const item of items) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    const textPart = item.content.find((part: any) => part?.type === "output_text" || part?.type === "text");
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

function parseStrictJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("Model output was not strict JSON.");
  }
  return JSON.parse(trimmed);
}

function buildPoseInsights(poses: Array<{ purpose: string[]; tags: string[]; stretches: string[]; strengthens: string[]; activates: string[]; relieves: string[] }>) {
  const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
  const purposes = uniq(poses.flatMap((pose) => pose.purpose ?? []));
  const tags = uniq(poses.flatMap((pose) => pose.tags ?? []));
  const stretches = uniq(poses.flatMap((pose) => pose.stretches ?? []));
  const strengthens = uniq(poses.flatMap((pose) => pose.strengthens ?? []));
  const activates = uniq(poses.flatMap((pose) => pose.activates ?? []));
  const relieves = uniq(poses.flatMap((pose) => pose.relieves ?? []));

  return [
    purposes.length ? `Célok (összesített): ${purposes.join(", ")}` : null,
    tags.length ? `Fókusz területek (összesített): ${tags.join(", ")}` : null,
    stretches.length ? `Nyújtás: ${stretches.join(", ")}` : null,
    strengthens.length ? `Erősítés: ${strengthens.join(", ")}` : null,
    activates.length ? `Aktiválás: ${activates.join(", ")}` : null,
    relieves.length ? `Enyhítés: ${relieves.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(payload: Payload, poseContext?: string) {
  const details = [
    `Cím: ${payload.title}`,
    `Kategória: ${payload.category}`,
    payload.duration_minutes ? `Időtartam: ${payload.duration_minutes} perc` : null,
    payload.intensity ? `Intenzitás: ${payload.intensity}/3` : null,
    payload.channel ? `Csatorna: ${payload.channel}` : null,
    payload.link ? `Link: ${payload.link}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const source = payload.source_description?.trim();
  const poseBlock = !source && poseContext ? `\nPózok alapján készült összesítés (ne nevezz meg pózokat!):\n${poseContext}\n` : "";

  return `Feladat: adj meta leírást egy YouTube jóga videóhoz.
Kimenet legyen rövid, természetes hangvételű magyar szöveg. Kerüld a gyógyhatás/egészségügyi ígéreteket.
Ha nincs forrás leírás, akkor a pózok összesített jellemzői alapján írj kedvcsináló összefoglalót, de NE nevezd meg a pózokat és ne sorolj pózokat.
Adj:
- description_short: 1 mondat, max 140 karakter
- description_long: 4-6 mondat
- style: válassz a következőkből: ${YogaVideoStyleEnum.options.join(", ")}
- channel: ha nem tudod, üres string

Videó adatok:
${details}
${source ? `\nForrás leírás (YouTube):\n${source}\n` : ""}${poseBlock}
`;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch (err) {
    return jsonError("request_parse", (err as Error)?.message ?? "Invalid JSON");
  }

  if (!payload?.title) return jsonError("request_parse", "title is required");

  const aiModel = process.env.YOGI_AI_MODEL;
  if (!aiModel) {
    return jsonError("request_parse", "Missing YOGI_AI_MODEL env", 500);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError("request_parse", "Missing OPENAI_API_KEY env", 500);
  }

  const client = new OpenAI({ apiKey });
  let poseContext = "";
  if (!payload.source_description && payload.pose_ids?.length) {
    try {
      const store = getYogiKnowledgeStore();
      const poses = await store.listPoses();
      const related = poses.filter((pose) => payload.pose_ids?.includes(pose.id));
      poseContext = buildPoseInsights(related as any);
    } catch {
      poseContext = "";
    }
  }
  const prompt = buildPrompt(payload, poseContext);

  let responseText = "";
  try {
    const response = await client.responses.create({
      model: aiModel,
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: "yoga_video_meta_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["description_short", "description_long", "style", "channel"],
            properties: {
              description_short: { type: "string" },
              description_long: { type: "string" },
              style: { type: "string", enum: YogaVideoStyleEnum.options },
              channel: { type: "string" },
            },
          },
        },
      },
    });
    responseText = getOutputText(response);
  } catch (err) {
    return jsonError("draft_api", (err as Error)?.message ?? "Draft api failed", 502);
  }

  let parsed: DraftResponse["draft"];
  try {
    parsed = parseStrictJson(responseText) as DraftResponse["draft"];
  } catch (err) {
    return jsonError("response_parse", (err as Error)?.message ?? "Invalid model JSON", 502);
  }

  const responsePayload: DraftResponse = {
    draft: {
      description_short: parsed.description_short,
      description_long: parsed.description_long,
      style: parsed.style,
      channel: parsed.channel?.trim() ? parsed.channel.trim() : null,
    },
    warnings: [],
  };

  return NextResponse.json(responsePayload);
}
