import type { Metadata } from "next";
import { notFound } from "next/navigation";
import YasuragiPrototype from "@/features/yasuragi/components/YasuragiPrototype";
import { PUBLICATION_ID } from "@/features/yasuragi/lib/practice-release-core";
import { readCurrentPublicPractice } from "@/features/yasuragi/lib/practice-public-read";

export const metadata: Metadata = { title: "Gyakorlás lejátszása | Yasuragi" };
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ practiceId: string }> };
export default async function YasuragiPublicPlayer({ params }: Props) {
  const { practiceId } = await params;
  if (!PUBLICATION_ID.test(practiceId)) notFound();
  const release = await readCurrentPublicPractice(practiceId);
  if (!release) notFound();
  return <YasuragiPrototype key={release.releaseId} script={release.script} poses={release.poses} title={release.title} fixture={false} publicMode />;
}
