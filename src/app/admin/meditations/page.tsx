import { redirect } from "next/navigation";

// The old authenticated meditation route remains a compatibility alias.
export default function LegacyAdminMeditationsPage() {
  redirect("/admin/tamayura");
}
