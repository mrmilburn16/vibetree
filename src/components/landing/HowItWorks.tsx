"use client";

import { Card } from "@/components/ui";

const steps = [
  {
    title: "Describe your app",
    description: "Tell the AI what you want in plain language—screens, features, and how it should feel.",
  },
  {
    title: "AI writes Swift",
    description: "Native SwiftUI code is generated and built in the cloud. You see edits and build status in real time.",
  },
  {
    title: "Preview live",
    description: "A real iOS Simulator streams to your browser. Tap and interact exactly as on a device.",
  },
  {
    title: "Install or publish",
    description: "Run on your iPhone with one click, or submit to the App Store in two clicks.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="landing-section flex min-h-full flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-heading-section mb-4 text-center">How it works</h2>
        <p className="text-body-muted mx-auto mb-12 max-w-xl text-center">
          From idea to App Store without opening Xcode.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Card
              key={step.title}
              className="animate-fade-in transition-transform hover:border-[var(--border-subtle)]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-caption mb-2 block font-medium text-[var(--badge-neutral)]">
                Step {i + 1}
              </span>
              <h3 className="text-heading-card mb-2">{step.title}</h3>
              <p className="text-body-muted text-sm">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
