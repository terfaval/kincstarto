import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SpiritDraftResponseSchema } from "@/lib/spiritDraftSchema";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { requireAdmin } from "@/lib/adminAuth";

const LIBRARY_PATH = join(process.cwd(), "data", "spirit", "library.json");

type Payload = {
  title: string;
  author: string;
  publisher?: string | null;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_")
    .toLowerCase();
}

function parseList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampList(list: string[], max: number) {
  return list.length > max ? list.slice(0, max) : list;
}

function pickEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  if (allowed.includes(value as T)) return value as T;
  return fallback;
}

function parseKeyValueDraft(
  text: string,
  library: ReturnType<typeof validateSpiritLibrary>,
  payload: Payload,
  searchMismatch: boolean
) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const values: Record<string, string> = {};
  for (const line of lines) {
    const match = /^([a-z_]+)\s*[:=]\s*(.*)$/i.exec(line);
    if (!match) continue;
    values[match[1].toLowerCase()] = match[2].trim();
  }

  const themeSlugs = library.thematic_pills.map((pill) => pill.slug);
  const themes = clampList(
    parseList(values.themes ?? "")
      .filter((slug) => themeSlugs.includes(slug)),
    4
  );

  const draft = {
    id: slugify(payload.title),
    title: payload.title,
    author: payload.author,
    tradition: pickEnum(values.tradition ?? "", ["taoizmus", "buddhizmus", "vegyes"], "vegyes"),
    level: pickEnum(values.level ?? "", ["kezdo", "kozep-halado", "halado"], "kozep-halado"),
    summary_short: values.summary_short ?? "Rovid, tenymegallapito osszefoglalas kesobb kitoltendo.",
    recommendation: values.recommendation ?? "Ajanas kesobb kitoltendo.",
    themes: themes.length > 0 ? themes : [themeSlugs[0]],
    language: values.language ?? "hu",
    format: pickEnum(values.format ?? "", ["konyv", "kommentar", "valogatas", "szutra", "essze"], "konyv"),
    status: "olvasatlan",
    summary_long: values.summary_long ?? "Hosszabb osszefoglalo kesobb kitoltendo.",
    prerequisites: clampList(parseList(values.prerequisites ?? ""), 3),
    cautions: values.cautions ?? "Nincs megadva.",
    tags: clampList(parseList(values.tags ?? ""), 5),
    notes: values.notes ?? "",
    year: values.year ?? "",
    related: clampList(parseList(values.related ?? ""), 4),
  };

  const warnings = parseList(values.warnings ?? "");
  const uncertain_fields = parseList(values.uncertain_fields ?? "");
  if (searchMismatch) warnings.push("search_mismatch");
  warnings.push("kv_fallback");

  return {
    draft,
    confidence: {},
    warnings,
    uncertain_fields,
    sources: [],
  };
}

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
    const textPart = item.content.find(
      (part: any) => part?.type === "output_text" || part?.type === "text"
    );
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

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
      `identified_title, identified_author, language, format, tradition, short_summary, sources (array of {title, url}), match_to_input (true/false), match_notes.\n` +
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
        match_to_input: false,
        match_notes: "no search output",
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

    const inputTitleKey = normalizeKey(payload.title);
    const inputAuthorKey = normalizeKey(payload.author);
    const identifiedTitleKey =
      typeof (searchJson as any)?.identified_title === "string"
        ? normalizeKey((searchJson as any).identified_title)
        : "";
    const identifiedAuthorKey =
      typeof (searchJson as any)?.identified_author === "string"
        ? normalizeKey((searchJson as any).identified_author)
        : "";
    const searchMismatch =
      Boolean(identifiedTitleKey || identifiedAuthorKey) &&
      (identifiedTitleKey !== inputTitleKey || identifiedAuthorKey !== inputAuthorKey);

    const draftPrompt = `You are drafting a curated spiritual book entry. Output JSON only, with schema: ` +
      `{ draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
      `\nRules: use only existing themes, no new slugs. status must be "olvasatlan". ` +
      `Do not invent facts; if uncertain, add warnings + uncertain_fields. ` +
      `Primary truth is the user input title/author. Do not substitute a different book. ` +
      `If search evidence is for a different book, add warning "search_mismatch" and keep user input.` +
      `Prerequisites must be decided (not always []).` +
      `Style: objective, non-marketing. Output compact JSON (no extra whitespace).` +
      `Length limits: summary_short <= 240 chars; summary_long <= 600 chars; recommendation <= 300 chars; cautions <= 200 chars; notes <= 200 chars.` +
      `Array limits: themes<=4, prerequisites<=3, related<=4, tags<=5, sources<=3.\n\n` +
      `User input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}".\n` +
      `Search mismatch: ${searchMismatch ? "true" : "false"}.\n` +
      `Existing themes: ${library.thematic_pills.map((p) => `${p.slug} (${p.label})`).join(", ")}\n` +
      `Existing books (for related suggestions): ${library.books
        .map((b) => `${b.id}|${b.title}|${b.author}`)
        .slice(0, 12)
        .join("; ")}\n\n` +
      `Search evidence: ${JSON.stringify(searchJson)}\n`;

    let draftResponse = await client.responses.create({
      model: aiModel,
      input: draftPrompt,
      max_output_tokens: 2200,
      text: { format: { type: "json_object" } },
    });

    let draftText = getOutputText(draftResponse);
    const draftIncomplete = (draftResponse as any).incomplete_details ?? null;
    if (!draftText && draftIncomplete?.reason === "max_output_tokens") {
      const smallerPrompt =
        `You are drafting a curated spiritual book entry. Output JSON only, with schema: ` +
        `{ draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
        `\nRules: use only existing themes, no new slugs. status must be "olvasatlan". ` +
        `Do not invent facts; if uncertain, add warnings + uncertain_fields. ` +
        `Prerequisites must be decided (not always []).` +
        `Style: objective, non-marketing. Output compact JSON (no extra whitespace).` +
        `Length limits: summary_short <= 200 chars; summary_long <= 450 chars; recommendation <= 240 chars; cautions <= 160 chars; notes <= 160 chars.` +
        `Array limits: themes<=3, prerequisites<=2, related<=3, tags<=4, sources<=2.\n\n` +
        `Existing themes: ${library.thematic_pills.map((p) => `${p.slug} (${p.label})`).join(", ")}\n` +
        `Existing books (for related suggestions): ${library.books
          .map((b) => `${b.id}|${b.title}`)
          .slice(0, 6)
          .join("; ")}\n\n` +
        `Search evidence: ${JSON.stringify(searchJson)}\n`;

      draftResponse = await client.responses.create({
        model: aiModel,
        input: smallerPrompt,
        max_output_tokens: 2400,
        text: { format: { type: "json_object" } },
      });
      draftText = getOutputText(draftResponse);
    }

    if (
      (!draftText || (draftResponse as any).incomplete_details?.reason === "max_output_tokens")
    ) {
      const ultraPrompt =
        `Return JSON only. Schema: { draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
        `\nRules: compact JSON, no extra whitespace. Use only existing themes. status must be "olvasatlan".` +
        `Do not invent facts; if uncertain, add warnings + uncertain_fields.` +
        `summary_short<=160 chars; summary_long<=300 chars; recommendation<=180 chars; cautions<=120 chars; notes<=120 chars.` +
        `Array limits: themes<=3, prerequisites<=2, related<=2, tags<=3, sources<=2.` +
        `If unknown, use empty string for notes and cautions (but not null).` +
        `Existing themes: ${library.thematic_pills.map((p) => p.slug).join(", ")}. ` +
        `Search evidence: ${JSON.stringify(searchJson)}.`;

      draftResponse = await client.responses.create({
        model: aiModel,
        input: ultraPrompt,
        max_output_tokens: 1600,
        text: { format: { type: "json_object" } },
      });
      draftText = getOutputText(draftResponse);
    }
    let draftJson: unknown;
    try {
      draftJson = JSON.parse(draftText);
      const parsedDraft = SpiritDraftResponseSchema.parse(draftJson);
      return NextResponse.json(parsedDraft);
    } catch {
      try {
        draftJson = extractJson(draftText);
        const parsedDraft = SpiritDraftResponseSchema.parse(draftJson);
        return NextResponse.json(parsedDraft);
      } catch {
        // Fallback: ask for compact key-value output and build JSON server-side.
        const kvPrompt =
          `Return key-value lines only (no JSON). One per line as key=value. ` +
          `Use | as list separator. Keys: title, author, tradition, level, summary_short, summary_long, ` +
          `recommendation, cautions, themes, language, format, prerequisites, related, tags, notes, year, warnings, uncertain_fields.` +
          `Rules: keep it short; no extra commentary. If unsure, leave value empty.` +
          `Use only these theme slugs: ${library.thematic_pills.map((p) => p.slug).join(", ")}.` +
          `User input (author/title must match): title="${payload.title}", author="${payload.author}". ` +
          `Search mismatch: ${searchMismatch ? "true" : "false"}.`;

        const kvResponse = await client.responses.create({
          model: aiModel,
          input: kvPrompt,
          max_output_tokens: 900,
        });

        const kvText = getOutputText(kvResponse);
        const kvDraft = parseKeyValueDraft(kvText, library, payload, searchMismatch);
        const parsedDraft = SpiritDraftResponseSchema.parse(kvDraft);
        return NextResponse.json(parsedDraft);
      }
    }
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
