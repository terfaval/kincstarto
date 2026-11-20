import { notFound, redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";

export const metadata = { title: "Yogi's Choice" };
export const dynamic = "force-dynamic";

// Former public entry point. Keep existing links usable for authenticated admins.
export default async function YogisChoicePage() {
  if (!(await isAdminRequest())) notFound();
  redirect("/admin/yogis-choice");
}
