import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";
import type { Metadata } from "next";
import YasuragiPracticeAdmin from "@/features/yasuragi/components/YasuragiPracticeAdmin";

export const metadata: Metadata = { title: "Yasuragi – gyakorlástervezetek" };
export const dynamic = "force-dynamic";
export default async function YasuragiPracticesPage() {
  if (!(await isAdminRequest())) redirect("/login");
  return <YasuragiPracticeAdmin />;
}
