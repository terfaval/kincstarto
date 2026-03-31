import YogiKnowledgeAdmin from "@/components/yogi/YogiKnowledgeAdmin";

export const metadata = {
  title: "Yogi's Choice",
};

export const dynamic = "force-dynamic";

export default function YogisChoicePublicPage() {
  return <YogiKnowledgeAdmin mode="public" />;
}
