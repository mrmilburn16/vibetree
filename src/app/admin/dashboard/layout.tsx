import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");
  return <>{children}</>;
}
