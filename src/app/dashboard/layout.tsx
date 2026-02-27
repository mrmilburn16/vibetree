import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Vibetree dashboard — create new apps, manage projects, and track builds.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
