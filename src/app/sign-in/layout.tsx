import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Vibetree account to continue building iOS apps.",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
