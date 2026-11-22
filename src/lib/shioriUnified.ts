import type { SpiritLibrary, SpiritBook, SpiritPath, SpiritPill } from "./spiritSchema";
import { planSpiritJsonImport, SpiritJsonImportError } from "./spiritJsonImport";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const SHIORI_STARTUP_INSTRUCTIONS = `Shiori Könyvtárműhely – szerkesztői munkacsomag. A library a közös katalógus aktuális állapota, személyes státuszok és jegyzetek nélkül. Feladat: bibliográfiai és tartalmi ellenőrzés, ismertetők, témák, címkék, kapcsolatok és olvasási utak gondozása. Őrizd meg a könyvazonosítókat; ne találj ki tényeket. Kizárólag a tényleges módosításokat add vissza egy shiori.result.v1 JSON-ban. Alak: {"format":"shiori.result.v1","baseSha":"<startup.baseSha>","changes":{"books":[{"id":"meglevo_id","tags":["..."]}],"tag_labels":{"kulcs":"Megjelenő felirat"},"thematic_pills":[{"slug":"...","label":"...","short_label":"...","color":"#112233"}],"paths":[{"id":"...","title":"...","book_ids":["..."]}]}}. A books rekordok csak a módosítandó mezőket tartalmazzák. A tag_labels részleges kulcsfrissítés; null törlés. A thematic_pills és paths rekordok ID/slug szerint részleges frissítések, meglévőnél teljes objektumként. Nem szereplő elem változatlan. Nincs könyvtörlés. Privát status, notes és útvonal-progress/comment nem módosítható. A skill telepítése külön ChatGPT-folyamat; az admin csak a kompatibilis JSON-szerződést biztosítja.`;
export function startup(library: SpiritLibrary, baseSha: string) {
  return { format: "shiori.startup.v1", baseSha, instructions: SHIORI_STARTUP_INSTRUCTIONS,
    skill: { name: "shiori-authoring", installation: "A skillt külön kell telepíteni ChatGPT-ben; nem szükséges az importhoz." },
    library: { ...library, books: library.books.map(({status: _status, notes: _notes, ...book}) => book),
      paths: library.paths?.map(({progress: _progress, items, ...path}) => ({...path, ...(items ? {items: items.map(({comment: _comment, ...item}) => item)} : {})})) },
    result_example: { format: "shiori.result.v1", baseSha, changes: { books: [{id: "letezo_konyv_id", tags: ["pelda"]}], tag_labels: {pelda: "Példa"} } } };
}
export function planUnified(current: SpiritLibrary, source: unknown, baseSha: string) {
  if (!record(source) || source.format !== "shiori.result.v1" || source.baseSha !== baseSha || !record(source.changes)) throw new SpiritJsonImportError("Nem megfelelő Result-formátum vagy elavult Startup Kit. Exportálj új Startup JSON-t.");
  const changes = source.changes;
  for (const key of Object.keys(changes)) if (!["books", "tag_labels", "thematic_pills", "paths"].includes(key)) throw new SpiritJsonImportError(`Nem támogatott módosítás: ${key}`);
  let candidate: SpiritLibrary = {...current, books: current.books.map(b => ({...b}))};
  const summary: Record<string, unknown> = {booksAdded: 0, booksUpdated: 0, bookFields: [] as unknown[], tagLabels: [] as string[], pills: [] as string[], paths: [] as string[]};
  if (changes.books !== undefined) {
    const planned = planSpiritJsonImport(candidate, {books: changes.books}, "upsert");
    candidate = planned.candidate;
    summary.booksAdded = planned.summary.added.length;
    summary.booksUpdated = planned.summary.updated.length;
    summary.bookFields = planned.summary.updated;
  }
  if (changes.tag_labels !== undefined) {
    if (!record(changes.tag_labels)) throw new SpiritJsonImportError("A tag_labels objektum legyen.");
    const labels = {...(candidate.tag_labels ?? {})};
    for (const [key, value] of Object.entries(changes.tag_labels)) {
      if (!key.trim() || (value !== null && (typeof value !== "string" || !value.trim()))) throw new SpiritJsonImportError(`Érvénytelen címkefelirat: ${key}`);
      if (value === null) delete labels[key]; else labels[key] = value as string;
      if (!same(candidate.tag_labels?.[key], labels[key])) (summary.tagLabels as string[]).push(key);
    }
    candidate.tag_labels = labels;
  }
  for (const [field, idKey] of [["thematic_pills", "slug"], ["paths", "id"]] as const) {
    if (changes[field] === undefined) continue;
    if (!Array.isArray(changes[field])) throw new SpiritJsonImportError(`${field} tömb legyen.`);
    const rows = changes[field] as unknown[];
    const target = [...(candidate[field] ?? [])] as (SpiritPath | SpiritPill)[];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!record(row) || typeof row[idKey] !== "string" || !row[idKey]) throw new SpiritJsonImportError(`Hiányzó ${field}.${idKey}`);
      const id = row[idKey] as string;
      if (seen.has(id)) throw new SpiritJsonImportError(`Duplikált ${field}: ${id}`);
      seen.add(id);
      const index = target.findIndex(item => (item as unknown as Record<string, unknown>)[idKey] === id);
      if (field === "paths" && (Object.hasOwn(row, "progress") || (Array.isArray(row.items) && row.items.some(item => record(item) && Object.hasOwn(item, "comment"))))) throw new SpiritJsonImportError("Személyes útvonal-progress és comment nem importálható.");
      const previous = index < 0 ? undefined : target[index];
      const next = {...(previous ?? {}), ...row} as SpiritPath | SpiritPill;
      if (field === "paths" && previous && "progress" in previous) (next as SpiritPath).progress = previous.progress;
      if (field === "paths" && previous && "items" in previous && Array.isArray((next as SpiritPath).items)) {
        const comments = new Map((previous as SpiritPath).items?.map(item => [item.book_id, item.comment]));
        (next as SpiritPath).items = (next as SpiritPath).items?.map(item => ({...item, ...(comments?.get(item.book_id) ? {comment: comments.get(item.book_id)} : {})}));
      }
      if (!same(previous, next)) {
        (summary[field === "paths" ? "paths" : "pills"] as string[]).push(id);
        if (index < 0) target.push(next); else target[index] = next;
      }
    }
    if (field === "paths") candidate.paths = target as SpiritPath[];
    else candidate.thematic_pills = target as SpiritPill[];
  }
  const changeCount = Number(summary.booksAdded) + Number(summary.booksUpdated) + (summary.tagLabels as string[]).length + (summary.pills as string[]).length + (summary.paths as string[]).length;
  return {candidate, summary, changeCount};
}
