"use client";

import { Card } from "@/components/ui";

const features = [
  {
    title: "Native Swift & SwiftUI",
    description: "Real iOS apps built the way Apple intends—performance and polish, not a web view.",
  },
  {
    title: "Live Simulator in the browser",
    description: "Stream the iOS Simulator to your browser. Touch and interact with your app in real time.",
  },
  {
    title: "Install on device",
    description: "One click to install on your iPhone. No Xcode, no provisioning profiles on your machine.",
  },
  {
    title: "Two clicks to App Store",
    description: "Sign in with Apple Developer once. Every submission after that is a single click.",
  },
];

export function Features() {
  return (
    <section id="features" className="landing-section flex min-h-full flex-col justify-center border-t border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-heading-section mb-4 text-center">Everything you need to ship</h2>
        <p className="text-body-muted mx-auto mb-12 max-w-xl text-center">
          The first Swift app builder on the web. Build, preview, and publish from one place.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature, i) => (
            <Card key={feature.title} className="animate-fade-in">
              <h3 className="text-heading-card mb-2">{feature.title}</h3>
              <p className="text-body-muted text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
