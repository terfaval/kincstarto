import { notFound } from "next/navigation";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { normalizeSlug } from "@/lib/slug";
import { YogiPoseSheet } from "@/components/yogi/YogiKnowledgeSheets";
import styles from "@/components/yogi/YogiKnowledgeAdmin.module.css";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
      <Link href="/yogis-choice" className={styles.publicBackLink} aria-label="Vissza">
        <ChevronLeft size={18} />
        Vissza
      </Link>
      <div className={`admin-card ${styles.publicSheetCard}`}>
        <YogiPoseSheet pose={pose} />
      </div>
    </section>
  );
}
