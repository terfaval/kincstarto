import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";
import type { Metadata } from "next";
import Link from "next/link";
import YasuragiPrototype from "@/features/yasuragi/components/YasuragiPrototype";
import { loadYasuragiPosePreviews } from "@/features/yasuragi/lib/practice-library";
import { readPracticeDraft } from "@/features/yasuragi/lib/practice-draft-store";
import type { PracticeScript } from "@/features/yasuragi/lib/practice-types";
import rawScript from "../../../../data/yasuragi/foldon-dolgozas-prototype.json";

export const metadata: Metadata = { title: "Yasuragi – belső lejátszópróba" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ draft?: string }> };
export default async function YasuragiPrototypePage({ searchParams }: PageProps) {
  if (!(await isAdminRequest())) redirect("/login");
  const { draft } = await searchParams;
  let script: PracticeScript = rawScript as PracticeScript;
  let title = "Földön dolgozás";
  if (draft) {
    try {
      const saved = await readPracticeDraft(draft);
      if (!saved) return <main style={{ padding: 32 }}><h1>A tervezet nem található.</h1><p><Link href="/admin/yasuragi/practices">Vissza a gyakorlásokhoz</Link></p></main>;
      script = saved.script;
      title = (script as PracticeScript & { title?: string }).title ?? script.practiceId;
    } catch {
      return <main style={{ padding: 32 }}><h1>Nem sikerült betölteni a tervezetet.</h1><p>Lehet, hogy a privát tároló nem elérhető vagy az azonosító hibás.</p><Link href="/admin/yasuragi/practices">Vissza a gyakorlásokhoz</Link></main>;
    }
  }
  const poses = await loadYasuragiPosePreviews(script);
  return <YasuragiPrototype key={draft ?? "fixture"} script={script} poses={poses} title={title} fixture={!draft} />;
}
