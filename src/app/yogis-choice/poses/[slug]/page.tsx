import { notFound } from "next/navigation";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { normalizeSlug } from "@/lib/slug";
import { YogiPoseSheet } from "@/components/yogi/YogiKnowledgeSheets";
import styles from "@/components/yogi/YogiKnowledgeAdmin.module.css";
import backStyles from "@/features/meditations/styles/meditations.module.css";
import Link from "next/link";
import YogiChoiceBodyEffect from "@/components/yogi/YogiChoiceBodyEffect";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams?: { id?: string | string[] };
};

export async function generateMetadata({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  const idParam = Array.isArray(resolvedSearchParams?.id)
    ? resolvedSearchParams?.id[0]
    : resolvedSearchParams?.id;
  const target = normalizeSlug(resolvedParams.slug);
  const pose = poses.find((item) => {
    if (item.content_status !== "published") return false;
    return (
      (idParam ? item.id === idParam : false) ||
      item.slug === resolvedParams.slug ||
      item.id === resolvedParams.slug ||
      normalizeSlug(item.slug) === target ||
      normalizeSlug(item.id) === target
    );
  });

  if (!pose) {
    return { title: "Yogi's Choice" };
  }

  return { title: `${pose.name_en} · Yogi's Choice` };
}

export default async function YogisChoicePosePage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  const idParam = Array.isArray(resolvedSearchParams?.id)
    ? resolvedSearchParams?.id[0]
    : resolvedSearchParams?.id;
  const target = normalizeSlug(resolvedParams.slug);
  const pose = poses.find((item) => {
    if (item.content_status !== "published") return false;
    return (
      (idParam ? item.id === idParam : false) ||
      item.slug === resolvedParams.slug ||
      item.id === resolvedParams.slug ||
      normalizeSlug(item.slug) === target ||
      normalizeSlug(item.id) === target
    );
  });

  if (!pose) notFound();

  return (
    <section className={`admin-stack ${styles.page}`}>
      <YogiChoiceBodyEffect />
      <Link href="/yogis-choice" className={backStyles.backLink} aria-label="Vissza">
        <span className={backStyles.backIcon} aria-hidden="true">
          ‹
        </span>
        <span className={backStyles.backLabel}>vissza</span>
      </Link>
      <div className={`admin-card ${styles.publicSheetCard}`}>
        <YogiPoseSheet pose={pose} />
      </div>
    </section>
  );
}
