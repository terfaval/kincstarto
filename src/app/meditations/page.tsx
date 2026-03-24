import { redirect } from "next/navigation";
import { MeditationSpace, loadMeditations } from "@/features/meditations";
import { isAdminRequest } from "@/lib/adminAuth";

export const metadata = {
  title: "Meditacios ter",
  description: "Lassu, atmoszferikus meditacios ter",
};

export const dynamic = "force-dynamic";

export default async function MeditationPage() {
  if (!(await isAdminRequest())) {
    redirect("/login");
  }
  const meditations = await loadMeditations();
  return <MeditationSpace meditations={meditations} />;
}

