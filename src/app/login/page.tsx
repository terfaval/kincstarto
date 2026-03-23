import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/adminAuth";
import LoginOverlay from "./LoginOverlay";

export const metadata = {
  title: "Admin Login",
};

export default async function LoginPage() {
  if (await isAdminRequest()) {
    redirect("/admin");
  }
  return <LoginOverlay />;
}
