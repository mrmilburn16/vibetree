import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits",
  description: "View your Vibetree credit balance, purchase credits, and manage your plan.",
};

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
