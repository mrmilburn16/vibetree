import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  // Allow /admin (login) without session; require session for /admin/dashboard and below
  return <>{children}</>;
}
