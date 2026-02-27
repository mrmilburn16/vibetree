import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Vibetree documentation — learn how to describe, build, preview, and ship iOS apps with AI.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
