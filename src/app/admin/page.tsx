import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { AdminLoginForm } from "./AdminLoginForm";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/dashboard");
  return <AdminLoginForm />;
}
