"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

const HERO_WORDS = ["Build", "real", "iOS", "apps", "in", "your", "browser"];

export function Hero() {
  return (
    <section className="landing-section relative flex min-h-full flex-col justify-center overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, var(--button-primary-bg), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h1 className="text-heading-hero mb-6 flex flex-wrap justify-center gap-x-2 gap-y-1">
          {HERO_WORDS.map((word, i) => (
            <span
              key={word}
              className={`animate-word-reveal inline-block ${word === "browser" ? "text-[var(--link-default)]" : "text-[var(--text-primary)]"}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {word}{word === "browser" ? "" : " "}
            </span>
          ))}
        </h1>
        <p className="text-body-muted animate-fade-in mx-auto mb-8 max-w-xl text-lg" style={{ animationDelay: "400ms" }}>
          Describe your app in plain language. AI writes Swift, you preview live, and ship to your
          iPhone or the App Store—no Xcode required.
        </p>
        <p className="text-caption mb-10 animate-fade-in" style={{ animationDelay: "550ms" }}>
          No Xcode. No Mac required to start. One click to your iPhone.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in" style={{ animationDelay: "700ms" }}>
          <Link href="/dashboard">
            <Button variant="primary" className="min-w-[160px]">
              Start building
            </Button>
          </Link>
          <a href="#product">
            <Button variant="secondary">See the product</Button>
          </a>
        </div>
        <a
          href="#product"
          className="text-caption mt-12 flex flex-col items-center gap-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] animate-fade-in"
          style={{ animationDelay: "1000ms" }}
        >
          <span>Scroll to explore</span>
          <span className="animate-bounce" aria-hidden>↓</span>
        </a>
      </div>
    </section>
  );
}
