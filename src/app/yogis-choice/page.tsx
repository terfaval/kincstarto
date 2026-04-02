import Link from "next/link";
import YogiKnowledgeAdmin from "@/components/yogi/YogiKnowledgeAdmin";
import styles from "@/features/meditations/styles/meditations.module.css";
import yogiStyles from "@/components/yogi/YogiKnowledgeAdmin.module.css";

export const metadata = {
  title: "Yogi's Choice",
};

export const dynamic = "force-dynamic";

export default function YogisChoicePublicPage() {
  return (
    <>
      <Link
        href="/"
        className={`${styles.backLink} ${yogiStyles.yogiBackLink}`}
        aria-label="Vissza a főoldalra"
      >
        <span className={styles.backIcon} aria-hidden="true">
          ‹
        </span>
        <span className={styles.backLabel}>vissza</span>
      </Link>
      <YogiKnowledgeAdmin mode="public" showPropCatalog={false} />
    </>
  );
}
