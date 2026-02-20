"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

const LAST_UPDATED = "February 20, 2026";

const SECTIONS = [
  { id: "acceptance", label: "Acceptance" },
  { id: "use-of-service", label: "Use of Service" },
  { id: "account", label: "Account" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "privacy", label: "Privacy" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "limitation", label: "Limitation of Liability" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes" },
  { id: "governing-law", label: "Governing Law" },
  { id: "contact", label: "Contact" },
];

function ChevronUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function TermsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
      const headings = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
      const scrollY = window.scrollY + 120;
      for (let i = headings.length - 1; i >= 0; i--) {
        const el = headings[i];
        if (el && el.getBoundingClientRect().top + window.scrollY <= scrollY) {
          setActiveId(SECTIONS[i].id);
          return;
        }
      }
      setActiveId(null);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleTocClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[var(--border-default)] px-4 py-14 sm:px-6 sm:py-16">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--button-primary-bg), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-3xl">
            <h1 className="text-heading-hero animate-fade-in mb-3">Terms of Service</h1>
            <p className="text-body-muted text-sm">
              Last updated {LAST_UPDATED}
            </p>
          </div>
        </section>

        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:gap-12 lg:px-6 lg:py-14">
          {/* Sticky TOC */}
          <aside
            className="lg:sticky lg:top-24 lg:order-2 lg:w-52 lg:shrink-0"
            aria-label="On this page"
          >
            <nav className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
              <p className="text-caption mb-3 font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                On this page
              </p>
              <ul className="space-y-1">
                {SECTIONS.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => handleTocClick(e, id)}
                      className={`
                        block rounded-[var(--radius-sm)] py-1.5 px-2 text-sm transition-colors
                        ${activeId === id
                          ? "bg-[var(--button-primary-bg)]/15 text-[var(--link-default)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                        }
                      `}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Article */}
          <article
            className="min-w-0 flex-1 lg:order-1"
            style={{ scrollMarginTop: "6rem" }}
          >
            <div className="prose-terms mx-auto max-w-[65ch]">
              <Section id="acceptance" title="1. Acceptance">
                <p>
                  By accessing or using Vibetree (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. We may update these terms from time to time; your continued use after changes constitutes acceptance.
                </p>
              </Section>

              <Section id="use-of-service" title="2. Use of Service">
                <p>
                  You may use the Service to build, preview, and publish iOS applications in accordance with our documentation and acceptable use policy. You are responsible for your use of the Service and for any content or code you create. You must not use the Service for any illegal purpose, to infringe others&apos; rights, or to abuse or overload our systems.
                </p>
              </Section>

              <Section id="account" title="3. Account">
                <p>
                  You may need an account to use certain features. You must provide accurate information and keep your account secure. You are responsible for all activity under your account. Notify us promptly of any unauthorized access.
                </p>
              </Section>

              <Section id="intellectual-property" title="4. Intellectual Property">
                <p>
                  Vibetree and its licensors own all rights in the Service, including the platform, UI, and documentation. You retain ownership of the applications and content you create. By using the Service, you grant us a limited license to host, run, and display your content as needed to provide and improve the Service.
                </p>
              </Section>

              <Section id="privacy" title="5. Privacy">
                <p>
                  Your use of the Service is also governed by our <Link href="/privacy" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">Privacy Policy</Link>. By using the Service, you consent to the collection and use of information as described there.
                </p>
              </Section>

              <Section id="disclaimers" title="6. Disclaimers">
                <p>
                  The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or secure. Use of AI-generated code and builds is at your own risk; you are responsible for testing and compliance with app store and legal requirements.
                </p>
              </Section>

              <Section id="limitation" title="7. Limitation of Liability">
                <p>
                  To the maximum extent permitted by law, Vibetree and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from your use or inability to use the Service. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim, or one hundred dollars, whichever is greater.
                </p>
              </Section>

              <Section id="termination" title="8. Termination">
                <p>
                  We may suspend or terminate your access to the Service at any time, with or without cause or notice. You may stop using the Service at any time. Upon termination, your right to use the Service ceases. Provisions that by their nature should survive (including ownership, disclaimers, and limitation of liability) will survive.
                </p>
              </Section>

              <Section id="changes" title="9. Changes">
                <p>
                  We may modify these terms at any time. We will post the updated terms on this page and update the &quot;Last updated&quot; date. Material changes may be communicated by email or in-product notice. Your continued use after the effective date constitutes acceptance. If you do not agree, discontinue use of the Service.
                </p>
              </Section>

              <Section id="governing-law" title="10. Governing Law">
                <p>
                  These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts located in Delaware.
                </p>
              </Section>

              <Section id="contact" title="11. Contact">
                <p>
                  Questions about these terms? Contact us at{" "}
                  <a href="mailto:legal@vibetree.com" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
                    legal@vibetree.com
                  </a>{" "}
                  or through our <Link href="/contact" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">contact page</Link>.
                </p>
              </Section>
            </div>
          </article>
        </div>
      </main>

      {/* Back to top */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="animate-fade-in fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-secondary)] shadow-lg transition-all hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)]"
          aria-label="Back to top"
        >
          <ChevronUpIcon />
        </button>
      )}

      <Footer />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-[var(--border-default)] py-8 first:pt-4 last:border-b-0">
      <h2 className="text-heading-card mb-4">{title}</h2>
      <div className="text-body-muted space-y-4 text-[var(--text-secondary)] [&>p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
