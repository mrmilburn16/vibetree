import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Vibetree team. We'd love to hear your feedback, questions, or partnership inquiries.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
