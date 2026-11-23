import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";
import KaoriApp from "@/features/kaori/components/KaoriApp";
import { KAORI_QA_COUNTS, makeKaoriQAFixture } from "@/features/kaori/lib/qaFixture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kaori · admin QA előnézet",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ count?: string }> };
export default async function KaoriPreviewPage({ searchParams }: Props) {
  if (!(await isAdminRequest())) redirect("/login");
  const { count } = await searchParams;
  const parsed = count === undefined ? 11 : Number(count);
  const selected = KAORI_QA_COUNTS.some(n => n === parsed) ? parsed : 11;
  return <KaoriApp catalog={makeKaoriQAFixture(selected)} qaCount={selected} />;
}
