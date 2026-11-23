import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";
import KaoriAdmin from "./KaoriAdmin";
export const metadata={title:"Kaori Unified · Kincstartó admin"};
export const dynamic="force-dynamic";
export default async function KaoriAdminPage(){if(!(await isAdminRequest()))redirect("/login");return <KaoriAdmin/>;}
