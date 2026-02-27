import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Vibetree Terms of Service — the rules that govern your use of our platform.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
