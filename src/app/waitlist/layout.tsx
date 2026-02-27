import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Waitlist",
  description:
    "Be the first to build iOS apps with AI. Join the Vibetree waitlist and get early access.",
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
