import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminRequest())) {
    redirect("/login");
  }
  return <>{children}</>;
}
