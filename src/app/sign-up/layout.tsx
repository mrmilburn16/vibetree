import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free Vibetree account and start building real iOS apps in your browser.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
