import { redirect } from "next/navigation";

export const metadata = {
  title: "Meditations Admin Redirect",
};

export default function AdminMeditationsPage() {
  redirect("/meditations");
}
