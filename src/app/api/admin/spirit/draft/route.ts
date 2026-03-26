import { NextResponse } from "next/server";
import OpenAI from "openai";
import { SpiritDraftPreviewResponseSchema } from "@/lib/spiritDraftSchema";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary } from "@/lib/spiritLibrary";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV !== "production";

type Payload = {
  title: string;
  author: string;
  publisher?: string | null;
};

type Phase =
  | "request_parse"
  | "library_read"
  | "library_validation"
  | "search_api"
  | "search_parse"
  | "draft_api"
  | "draft_parse"
  | "draft_schema";

function phaseError(
  phase: Phase,
  error_code: string,
  detail: string,
  status = 500,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: "Draft failed",
      phase,
      error_code,
      detail,
      ...extra,
    },
    { status }
  );
}

function logEvent(level: "warn" | "error" | "info", message: string, extra?: unknown) {
  if (level === "warn") console.warn(`[spirit:draft] ${message}`, extra ?? "");
  else if (level === "error") console.error(`[spirit:draft] ${message}`, extra ?? "");
  else console.info(`[spirit:draft] ${message}`, extra ?? "");
}

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
    summary_short: values.summary_short ?? "",
    recommendation: values.recommendation ?? "",
    themes,
    language: values.language ?? "hu",
    format: pickEnum(values.format ?? "", ["konyv", "kommentar", "valogatas", "szutra", "essze"], "konyv"),
    status: "olvasatlan",
    summary_long: values.summary_long ?? "",
    prerequisites: clampList(parseList(values.prerequisites ?? ""), 3),
    cautions: values.cautions ?? "",
    tags: clampList(parseList(values.tags ?? ""), 5),
    notes: values.notes ?? "",
    year: values.year ?? null,
    related: clampList(parseList(values.related ?? ""), 4),
  };

  const warnings = parseList(values.warnings ?? "");
  const uncertain_fields = new Set(parseList(values.uncertain_fields ?? ""));
  const missingFields: Array<keyof typeof draft> = [
    "summary_short",
    "summary_long",
    "recommendation",
    "cautions",
  ];
  missingFields.forEach((field) => {
    if (!draft[field]) uncertain_fields.add(field);
  });
  if (searchMismatch) warnings.push("search_mismatch");
  warnings.push("kv_fallback");

  return {
    draft,
    confidence: {},
    warnings,
    uncertain_fields: Array.from(uncertain_fields),
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

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item: unknown) => coerceString(item)).filter(Boolean);
}

function normalizeDraftResponse(
  raw: any,
  library: ReturnType<typeof validateSpiritLibrary>,
  payload: Payload,
  opts: {
    searchMismatch: boolean;
    searchPartial: boolean;
    usedSearchExtract: boolean;
    usedDraftExtract: boolean;
    usedKvFallback: boolean;
  }
) {
  const warnings = new Set(
    Array.isArray(raw?.warnings)
      ? raw.warnings.filter((item: unknown): item is string => typeof item === "string")
      : []
  );
  const uncertain = new Set(
    Array.isArray(raw?.uncertain_fields)
      ? raw.uncertain_fields.filter((item: unknown): item is string => typeof item === "string")
      : []
  );

  if (opts.searchMismatch) warnings.add("search_mismatch");
  if (opts.searchPartial) warnings.add("search_partial");
  if (opts.usedSearchExtract) warnings.add("search_extract_fallback");
  if (opts.usedDraftExtract) warnings.add("draft_extract_fallback");
  if (opts.usedKvFallback) warnings.add("kv_fallback");

  const draft = raw?.draft ?? {};
  const themeSet = new Set(library.thematic_pills.map((pill) => pill.slug));
  const bookSet = new Set(library.books.map((book) => book.id));

  const rawTradition = coerceString(draft.tradition);
  const tradition = pickEnum(rawTradition, ["taoizmus", "buddhizmus", "vegyes"], "vegyes");
  if (tradition !== rawTradition) {
    warnings.add("invalid_tradition");
    uncertain.add("tradition");
  }

  const rawLevel = coerceString(draft.level);
  const level = pickEnum(rawLevel, ["kezdo", "kozep-halado", "halado"], "kozep-halado");
  if (level !== rawLevel) {
    warnings.add("invalid_level");
    uncertain.add("level");
  }

  const rawFormat = coerceString(draft.format);
  const format = pickEnum(rawFormat, ["konyv", "kommentar", "valogatas", "szutra", "essze"], "konyv");
  if (format !== rawFormat) {
    warnings.add("invalid_format");
    uncertain.add("format");
  }

  const rawLanguage = coerceString(draft.language);
  const language = pickEnum(rawLanguage, ["hu", "en", "egyeb"], "hu");
  if (language !== rawLanguage) {
    warnings.add("invalid_language");
    uncertain.add("language");
  }

  const themes = clampList(
    coerceStringArray(draft.themes).filter((slug) => themeSet.has(slug)),
    4
  );
  if (themes.length === 0) uncertain.add("themes");

  const related = clampList(
    coerceStringArray(draft.related).filter((id) => bookSet.has(id)),
    4
  );
  const prerequisites = clampList(coerceStringArray(draft.prerequisites), 3);
  const tags = clampList(coerceStringArray(draft.tags), 5);

  const summary_short = coerceString(draft.summary_short);
  const summary_long = coerceString(draft.summary_long);
  const recommendation = coerceString(draft.recommendation);
  const cautions = coerceString(draft.cautions);
  const notes = coerceString(draft.notes);

  if (!summary_short) uncertain.add("summary_short");
  if (!summary_long) uncertain.add("summary_long");
  if (!recommendation) uncertain.add("recommendation");
  if (!cautions) uncertain.add("cautions");

  const rawYear = coerceString(draft.year);
  const year = rawYear && /^\d{4}$/.test(rawYear) ? rawYear : null;
  if (rawYear && !year) {
    warnings.add("invalid_year");
    uncertain.add("year");
  }

  const sources = Array.isArray(raw?.sources)
    ? raw.sources
        .filter((item: unknown): item is { title: string; url?: unknown } =>
          Boolean(item && typeof (item as { title?: unknown }).title === "string")
        )
        .map((item: { title: string; url?: unknown }) => ({
          title: item.title,
          url: typeof item.url === "string" ? item.url : undefined,
        }))
        .slice(0, 3)
    : [];

  const confidence: Record<string, number | string> = {};
  if (raw?.confidence && typeof raw.confidence === "object") {
    Object.entries(raw.confidence as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "number" || typeof value === "string") {
        confidence[key] = value;
      }
    });
  }

  const normalized = {
    draft: {
      id: slugify(payload.title),
      title: payload.title,
      author: payload.author,
      tradition,
      level,
      summary_short,
      recommendation,
      themes,
      language,
      format,
      status: "olvasatlan",
      summary_long,
      prerequisites,
      cautions,
      tags,
      notes,
      year,
      related,
    },
    confidence,
    warnings: Array.from(warnings),
    uncertain_fields: Array.from(uncertain),
    sources,
  };

  return normalized;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    let payload: Payload;
    try {
      payload = (await request.json()) as Payload;
    } catch {
      return phaseError("request_parse", "INVALID_JSON", "Invalid JSON payload", 400);
    }

    if (!payload.title || !payload.author) {
      return phaseError("request_parse", "MISSING_FIELDS", "Title and author required", 400);
    }

    const searchModel = process.env.SPIRIT_SEARCH_MODEL;
    const aiModel = process.env.SPIRIT_AI_MODEL;
    const apiKey = process.env.OPENAI_API_KEY;

    const missingEnv: string[] = [];
    if (!searchModel) missingEnv.push("SPIRIT_SEARCH_MODEL");
    if (!aiModel) missingEnv.push("SPIRIT_AI_MODEL");
    if (!apiKey) missingEnv.push("OPENAI_API_KEY");

    if (missingEnv.length > 0) {
      return phaseError(
        "request_parse",
        "MISSING_ENV",
        "Missing OpenAI env config",
        500,
        { missing: missingEnv }
      );
    }

    let library: ReturnType<typeof validateSpiritLibrary>;
    try {
      library = await loadSpiritLibrary();
    } catch (err) {
      const detail = (err as Error)?.message ?? String(err);
      const phase = detail.includes("Spirit library validation failed")
        ? "library_validation"
        : "library_read";
      logEvent("error", "library load failed", detail);
      return phaseError(phase, "LIBRARY_LOAD_FAILED", detail, 500);
    }

    const client = new OpenAI({ apiKey });

    const searchPrompt = `Find reliable public references for the book below. Return JSON only with keys: \n` +
      `identified_title, identified_author, language, format, tradition, short_summary, sources (array of {title, url}), match_to_input (true/false), match_notes.\n` +
      `If uncertain, set fields to null and include a warning in short_summary.\n\n` +
      `Input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}".`;

    let searchResponse: any;
    try {
      searchResponse = await client.responses.create({
        model: searchModel,
        tools: [{ type: "web_search" }],
        input: searchPrompt,
        max_output_tokens: 1200,
      });
    } catch (err) {
      const detail = (err as Error)?.message ?? String(err);
      const error_code = detail.toLowerCase().includes("web_search")
        ? "SEARCH_TOOL_UNSUPPORTED"
        : "SEARCH_API_ERROR";
      logEvent("error", "search api failed", detail);
      return phaseError("search_api", error_code, detail, 502);
    }

    const searchText = getOutputText(searchResponse);
    const searchIncomplete = (searchResponse as any).incomplete_details ?? null;
    let searchJson: any;
    let usedSearchExtract = false;
    if (!searchText) {
      logEvent("warn", "search output empty");
      searchJson = {
        identified_title: null,
        identified_author: null,
        language: null,
        format: null,
        tradition: null,
        short_summary: null,
        sources: [],
        match_to_input: null,
        match_notes: "no search output",
      };
    } else {
      // Force a JSON parse pass without tools to avoid JSON mode + web_search conflict.
      let searchParseResponse: any;
      try {
        searchParseResponse = await client.responses.create({
          model: searchModel,
          input:
            `Return JSON only with keys: identified_title, identified_author, language, format, tradition, short_summary, ` +
            `sources (array of {title, url}), match_to_input, match_notes. ` +
            `If uncertain, set fields to null. Input text:\n` +
            `${searchText}`,
          max_output_tokens: 800,
          text: { format: { type: "json_object" } },
        });
      } catch (err) {
        const detail = (err as Error)?.message ?? String(err);
        logEvent("error", "search parse api failed", detail);
        return phaseError("search_parse", "SEARCH_PARSE_API_ERROR", detail, 502);
      }

      const parsedText = getOutputText(searchParseResponse);
      if (!parsedText) {
        logEvent("error", "search parse empty");
        return phaseError(
          "search_parse",
          "SEARCH_PARSE_EMPTY",
          "No JSON returned from search parse",
          502
        );
      }
      try {
        searchJson = JSON.parse(parsedText);
      } catch {
        try {
          searchJson = extractJson(parsedText);
          usedSearchExtract = true;
          logEvent("warn", "search extractJson fallback used");
        } catch {
          logEvent("error", "search parse failed", parsedText.slice(0, 200));
          return phaseError(
            "search_parse",
            "SEARCH_PARSE_FAILED",
            "Invalid search JSON",
            502,
            IS_DEV
              ? {
                  output_preview: parsedText.slice(0, 800),
                  incomplete_details: searchIncomplete,
                }
              : undefined
          );
        }
      }
    }

    const inputTitleKey = normalizeKey(payload.title);
    const inputAuthorKey = normalizeKey(payload.author);
    const identifiedTitleKey =
      typeof searchJson?.identified_title === "string"
        ? normalizeKey(searchJson.identified_title)
        : "";
    const identifiedAuthorKey =
      typeof searchJson?.identified_author === "string"
        ? normalizeKey(searchJson.identified_author)
        : "";

    let searchMismatch = false;
    let searchPartial = false;
    if (typeof searchJson?.match_to_input === "boolean") {
      searchMismatch = !searchJson.match_to_input;
    } else if (identifiedTitleKey && identifiedAuthorKey) {
      searchMismatch = identifiedTitleKey !== inputTitleKey || identifiedAuthorKey !== inputAuthorKey;
    } else if (identifiedTitleKey || identifiedAuthorKey) {
      searchPartial = true;
    }

    const draftPrompt = `You are drafting a curated spiritual book entry. Output JSON only, with schema: ` +
      `{ draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
      `\nRules: use only existing themes, no new slugs. status must be "olvasatlan". ` +
      `Do not invent facts; if uncertain, add warnings + uncertain_fields. ` +
      `Primary truth is the user input title/author. Do not substitute a different book. ` +
      `If search evidence is for a different book, add warning "search_mismatch" and keep user input.` +
      `Do not use placeholder text (no TODO/TBD/...). If unsure, leave field empty and mark uncertain_fields.` +
      `Prerequisites must be decided (not always []).` +
      `Style: objective, non-marketing. Output compact JSON (no extra whitespace).` +
      `Length limits: summary_short <= 240 chars; summary_long <= 600 chars; recommendation <= 300 chars; cautions <= 200 chars; notes <= 200 chars.` +
      `Array limits: themes<=4, prerequisites<=3, related<=4, tags<=5, sources<=3.\n\n` +
      `User input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}".\n` +
      `Search mismatch: ${searchMismatch ? "true" : "false"}.\n` +
      `Search partial: ${searchPartial ? "true" : "false"}.\n` +
      `Existing themes: ${library.thematic_pills.map((p) => `${p.slug} (${p.label})`).join(", ")}\n` +
      `Existing books (for related suggestions): ${library.books
        .map((b) => `${b.id}|${b.title}|${b.author}`)
        .slice(0, 12)
        .join("; ")}\n\n` +
      `Search evidence: ${JSON.stringify(searchJson)}\n`;

    let draftResponse: any;
    try {
      draftResponse = await client.responses.create({
        model: aiModel,
        input: draftPrompt,
        max_output_tokens: 2200,
        text: { format: { type: "json_object" } },
      });
    } catch (err) {
      const detail = (err as Error)?.message ?? String(err);
      logEvent("error", "draft api failed", detail);
      return phaseError("draft_api", "DRAFT_API_ERROR", detail, 502);
    }

    let draftText = getOutputText(draftResponse);
    const draftIncomplete = (draftResponse as any).incomplete_details ?? null;
    if (!draftText && draftIncomplete?.reason === "max_output_tokens") {
      const smallerPrompt =
        `You are drafting a curated spiritual book entry. Output JSON only, with schema: ` +
        `{ draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
        `\nRules: use only existing themes, no new slugs. status must be "olvasatlan". ` +
        `Do not invent facts; if uncertain, add warnings + uncertain_fields. ` +
        `Primary truth is the user input title/author. Do not substitute a different book. ` +
        `If search evidence is for a different book, add warning "search_mismatch" and keep user input.` +
        `Do not use placeholder text (no TODO/TBD/...). If unsure, leave field empty and mark uncertain_fields. ` +
        `Prerequisites must be decided (not always []).` +
        `Style: objective, non-marketing. Output compact JSON (no extra whitespace).` +
        `Length limits: summary_short <= 200 chars; summary_long <= 450 chars; recommendation <= 240 chars; cautions <= 160 chars; notes <= 160 chars.` +
        `Array limits: themes<=3, prerequisites<=2, related<=3, tags<=4, sources<=2.\n\n` +
        `User input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}".\n` +
        `Search mismatch: ${searchMismatch ? "true" : "false"}.\n` +
        `Search partial: ${searchPartial ? "true" : "false"}.\n` +
        `Existing themes: ${library.thematic_pills.map((p) => `${p.slug} (${p.label})`).join(", ")}\n` +
        `Existing books (for related suggestions): ${library.books
          .map((b) => `${b.id}|${b.title}`)
          .slice(0, 6)
          .join("; ")}\n\n` +
        `Search evidence: ${JSON.stringify(searchJson)}\n`;

      try {
        draftResponse = await client.responses.create({
          model: aiModel,
          input: smallerPrompt,
          max_output_tokens: 2400,
          text: { format: { type: "json_object" } },
        });
      } catch (err) {
        const detail = (err as Error)?.message ?? String(err);
        logEvent("error", "draft api (smaller) failed", detail);
        return phaseError("draft_api", "DRAFT_API_ERROR", detail, 502);
      }
      draftText = getOutputText(draftResponse);
    }

    if (
      (!draftText || (draftResponse as any).incomplete_details?.reason === "max_output_tokens")
    ) {
      const ultraPrompt =
        `Return JSON only. Schema: { draft: { id, title, author, tradition, level, summary_short, recommendation, themes, language, format, status, summary_long, prerequisites, cautions, tags, notes, year, related }, confidence, warnings, uncertain_fields, sources }.` +
        `\nRules: compact JSON, no extra whitespace. Use only existing themes. status must be "olvasatlan".` +
        `Do not invent facts; if uncertain, add warnings + uncertain_fields.` +
        `Primary truth is the user input title/author. Do not substitute a different book.` +
        `If search evidence is for a different book, add warning "search_mismatch" and keep user input.` +
        `Do not use placeholder text (no TODO/TBD/...). If unsure, leave field empty and mark uncertain_fields.` +
        `summary_short<=160 chars; summary_long<=300 chars; recommendation<=180 chars; cautions<=120 chars; notes<=120 chars.` +
        `Array limits: themes<=3, prerequisites<=2, related<=2, tags<=3, sources<=2.` +
        `If unknown, use empty string for notes and cautions (but not null).` +
        `User input: title="${payload.title}", author="${payload.author}", publisher="${payload.publisher ?? ""}". ` +
        `Search mismatch: ${searchMismatch ? "true" : "false"}. ` +
        `Search partial: ${searchPartial ? "true" : "false"}. ` +
        `Existing themes: ${library.thematic_pills.map((p) => p.slug).join(", ")}. ` +
        `Search evidence: ${JSON.stringify(searchJson)}.`;

      try {
        draftResponse = await client.responses.create({
          model: aiModel,
          input: ultraPrompt,
          max_output_tokens: 1600,
          text: { format: { type: "json_object" } },
        });
      } catch (err) {
        const detail = (err as Error)?.message ?? String(err);
        logEvent("error", "draft api (ultra) failed", detail);
        return phaseError("draft_api", "DRAFT_API_ERROR", detail, 502);
      }
      draftText = getOutputText(draftResponse);
    }
    let draftJson: unknown;
    let usedDraftExtract = false;
    try {
      draftJson = JSON.parse(draftText);
    } catch {
      try {
        draftJson = extractJson(draftText);
        usedDraftExtract = true;
        logEvent("warn", "draft extractJson fallback used");
      } catch {
        draftJson = null;
      }
    }

    if (draftJson) {
      try {
        const normalized = normalizeDraftResponse(draftJson, library, payload, {
          searchMismatch,
          searchPartial,
          usedSearchExtract,
          usedDraftExtract,
          usedKvFallback: false,
        });
        const parsedDraft = SpiritDraftPreviewResponseSchema.parse(normalized);
        return NextResponse.json(parsedDraft);
      } catch (err) {
        logEvent("error", "draft schema parse failed", (err as Error)?.message ?? err);
      }
    }

    // Fallback: ask for compact key-value output and build JSON server-side.
    const kvPrompt =
      `Return key-value lines only (no JSON). One per line as key=value. ` +
      `Use | as list separator. Keys: title, author, tradition, level, summary_short, summary_long, ` +
      `recommendation, cautions, themes, language, format, prerequisites, related, tags, notes, year, warnings, uncertain_fields.` +
      `Rules: keep it short; no extra commentary. If unsure, leave value empty.` +
      `Do not invent facts and do not use placeholder text.` +
      `Use only these theme slugs: ${library.thematic_pills.map((p) => p.slug).join(", ")}.` +
      `User input (author/title must match): title="${payload.title}", author="${payload.author}". ` +
      `Search mismatch: ${searchMismatch ? "true" : "false"}. ` +
      `Search partial: ${searchPartial ? "true" : "false"}.`;

    let kvResponse: any;
    try {
      kvResponse = await client.responses.create({
        model: aiModel,
        input: kvPrompt,
        max_output_tokens: 900,
      });
    } catch (err) {
      const detail = (err as Error)?.message ?? String(err);
      logEvent("error", "draft api (kv) failed", detail);
      return phaseError("draft_api", "DRAFT_API_ERROR", detail, 502);
    }

    const kvText = getOutputText(kvResponse);
    const kvDraft = parseKeyValueDraft(kvText, library, payload, searchMismatch);
    try {
      const normalized = normalizeDraftResponse(kvDraft, library, payload, {
        searchMismatch,
        searchPartial,
        usedSearchExtract,
        usedDraftExtract: false,
        usedKvFallback: true,
      });
      const parsedDraft = SpiritDraftPreviewResponseSchema.parse(normalized);
      return NextResponse.json(parsedDraft);
    } catch (err) {
      const detail = (err as Error)?.message ?? String(err);
      logEvent("error", "draft schema parse failed (kv)", detail);
      return phaseError("draft_schema", "DRAFT_SCHEMA_FAILED", detail, 500);
    }
  } catch (err) {
    const detail = (err as Error)?.message ?? String(err);
    logEvent("error", "unhandled draft error", detail);
    return phaseError("draft_parse", "UNHANDLED_ERROR", detail, 500);
  }
}
