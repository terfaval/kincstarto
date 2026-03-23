import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SpiritDraftResponseSchema } from "@/lib/spiritDraftSchema";
import { validateSpiritLibrary } from "@/lib/spiritSchema";

const LIBRARY_PATH = join(process.cwd(), "data", "spirit", "library.json");

type Payload = {
  title: string;
  author: string;
  publisher?: string | null;
};

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function getOutputText(response: any) {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const items = Array.isArray(response?.output) ? response.output : [];
  for (const item of items) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    const textPart = item.content.find((part: any) => part?.type === "output_text");
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

export async function POST(request: Request) {
  try {
    let payload: Payload;
    try {
      payload = (await request.json()) as Payload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload.title || !payload.author) {
      return NextResponse.json({ error: "Title and author required" }, { status: 400 });
    }

    const searchModel = process.env.SPIRIT_SEARCH_MODEL;
    const aiModel = process.env.SPIRIT_AI_MODEL;
    const apiKey = process.env.OPENAI_API_KEY;

    const missingEnv: string[] = [];
    if (!searchModel) missingEnv.push("SPIRIT_SEARCH_MODEL");
    if (!aiModel) missingEnv.push("SPIRIT_AI_MODEL");
    if (!apiKey) missingEnv.push("OPENAI_API_KEY");

    if (missingEnv.length > 0) {
      return NextResponse.json(
        { error: "Missing OpenAI env config", missing: missingEnv },
        { status: 500 }
      );
    }

    const raw = await readFile(LIBRARY_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const library = validateSpiritLibrary(parsed);

    const client = new OpenAI({ apiKey });

    const searchPrompt = `Find reliable public references for the book below. Return JSON only with keys: \n` +
      `identified_title, identified_author, language, format, tradition, short_summary, sources (array of {title, url}).\n` +
      `If uncertain, set fields to null and include a warning in short_summary.\n\n` +
      `Input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}".`;

    const searchResponse = await client.responses.create({
      model: searchModel,
      tools: [{ type: "web_search" }],
      input: searchPrompt,
      max_output_tokens: 1200,
    });

    const searchText = getOutputText(searchResponse);
    const searchIncomplete = (searchResponse as any).incomplete_details ?? null;
    let searchJson: unknown;
    if (!searchText) {
      searchJson = {
        identified_title: null,
        identified_author: null,
        language: null,
        format: null,
        tradition: null,
        short_summary: "No search output returned; proceeding without evidence.",
        sources: [],
      };
    } else {
      try {
        searchJson = JSON.parse(searchText);
      } catch {
        try {
          searchJson = extractJson(searchText);
        } catch {
          return NextResponse.json(
            {
              error: "Invalid search JSON",
              output_preview: searchText.slice(0, 800),
              incomplete_details: searchIncomplete,
            },
            { status: 502 }
          );
        }
      }
    }

    const draftPrompt = `You are drafting a curated spiritual book entry. Output JSON only, with schema: ` +
      `{ draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
      `\nRules: use only existing themes, no new slugs. status must be "olvasatlan". ` +
      `Do not invent facts; if uncertain, add warnings + uncertain_fields. ` +
      `Prerequisites must be decided (not always []).` +
      `Style: objective, non-marketing.\n\n` +
      `Existing themes: ${library.thematic_pills.map((p) => `${p.slug} (${p.label})`).join(", ")}\n` +
      `Existing books (for related suggestions): ${library.books.map((b) => `${b.id}|${b.title}|${b.author}|${b.tradition}|${b.level}|${b.themes.join("/")}`).slice(0, 80).join("; ")}\n\n` +
      `Search evidence: ${JSON.stringify(searchJson)}\n`;

    const draftResponse = await client.responses.create({
      model: aiModel,
      input: draftPrompt,
      max_output_tokens: 1400,
      text: { format: { type: "json_object" } },
    });

    const draftText = getOutputText(draftResponse);
    let draftJson: unknown;
    try {
      draftJson = JSON.parse(draftText);
    } catch {
      try {
        draftJson = extractJson(draftText);
      } catch {
        return NextResponse.json(
          {
            error: "Invalid draft JSON",
            output_preview: draftText.slice(0, 800),
            incomplete_details: (draftResponse as any).incomplete_details ?? null,
          },
          { status: 502 }
        );
      }
    }

    const parsedDraft = SpiritDraftResponseSchema.parse(draftJson);

    return NextResponse.json(parsedDraft);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Draft failed",
        detail: (err as Error)?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
