import { MeditationSpace, loadMeditations } from "@/features/meditations";

export const metadata = {
  title: "Meditacios ter",
  description: "Lassu, atmoszferikus meditacios ter",
};

export const dynamic = "force-dynamic";

export default async function MeditationPage() {
  const meditations = await loadMeditations();
  return <MeditationSpace meditations={meditations} />;
}

