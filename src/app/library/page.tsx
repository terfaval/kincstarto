import { redirect } from "next/navigation";

// Preserve legacy inbound links. The public Shiori canonical path is /shiori.
export default function LegacyLibraryPage() {
  redirect("/shiori");
}
