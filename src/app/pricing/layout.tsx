import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose the right Vibetree plan for you. Free Creator tier, Pro, and Team plans with monthly and annual billing.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
