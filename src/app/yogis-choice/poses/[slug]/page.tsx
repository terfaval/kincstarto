import { notFound } from "next/navigation";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { normalizeSlug } from "@/lib/slug";
import { YogiPoseSheet } from "@/components/yogi/YogiKnowledgeSheets";
import styles from "@/components/yogi/YogiKnowledgeAdmin.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props) {
  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  const target = normalizeSlug(params.slug);
  const pose = poses.find((item) => {
    if (item.status !== "active") return false;
    return (
      item.slug === params.slug ||
      item.id === params.slug ||
      normalizeSlug(item.slug) === target ||
      normalizeSlug(item.id) === target
    );
  });

  if (!pose) {
    return { title: "Yogi's Choice" };
  }

  return { title: `${pose.name_en} · Yogi's Choice` };
}

export default async function YogisChoicePosePage({ params }: Props) {
  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  const target = normalizeSlug(params.slug);
  const pose = poses.find((item) => {
    if (item.status !== "active") return false;
    return (
      item.slug === params.slug ||
      item.id === params.slug ||
      normalizeSlug(item.slug) === target ||
      normalizeSlug(item.id) === target
    );
  });

  if (!pose) notFound();

  return (
    <section className={`admin-stack ${styles.page}`}>
      <div className="admin-card">
        <YogiPoseSheet pose={pose} />
      </div>
    </section>
  );
}
