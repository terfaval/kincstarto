import { redirect } from "next/navigation";

// Preserve legacy inbound links. The public Tamayura canonical path is /tamayura.
export default function LegacyMeditationsPage() {
  redirect("/tamayura");
}
