"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Card } from "@/components/ui";

const LAST_UPDATED = "February 20, 2026";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "data-we-collect", label: "Data We Collect" },
  { id: "how-we-use", label: "How We Use It" },
  { id: "sharing", label: "Sharing" },
  { id: "cookies", label: "Cookies" },
  { id: "retention", label: "Retention" },
  { id: "security", label: "Security" },
  { id: "your-rights", label: "Your Rights" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

function ChevronUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function PrivacyPage() {
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
            <h1 className="text-heading-hero animate-fade-in mb-3">Privacy Policy</h1>
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
              {/* At a glance — UX differentiator */}
              <Card className="mb-10 border-[var(--border-subtle)] bg-[var(--background-tertiary)]/50 p-5">
                <h2 className="text-heading-card mb-3">At a glance</h2>
                <ul className="text-body-muted space-y-2 text-sm [&>li]:flex [&>li]:items-start [&>li]:gap-2">
                  <li>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--semantic-info)]" aria-hidden />
                    We collect account, usage, and app data to run and improve the product.
                  </li>
                  <li>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--semantic-info)]" aria-hidden />
                    We don&apos;t sell your data. We share only as needed to operate the service.
                  </li>
                  <li>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--semantic-info)]" aria-hidden />
                    You can request access, correction, or deletion; contact us below.
                  </li>
                  <li>
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--semantic-info)]" aria-hidden />
                    We use cookies for auth and preferences; see the Cookies section for details.
                  </li>
                </ul>
              </Card>

              <Section id="overview" title="1. Overview">
                <p>
                  Vibetree (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy. This policy describes what data we collect when you use our Service, how we use and protect it, and your choices. By using Vibetree, you agree to this Privacy Policy. Our <Link href="/terms" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">Terms of Service</Link> also apply.
                </p>
              </Section>

              <Section id="data-we-collect" title="2. Data We Collect">
                <p>
                  We collect information you provide and data we get from your use of the Service:
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--text-secondary)]">
                  <li><strong className="text-[var(--text-primary)]">Account data</strong> — email, password (hashed), and profile details you give when signing up.</li>
                  <li><strong className="text-[var(--text-primary)]">App and project data</strong> — app names, bundle IDs, settings, and the content you create in the editor.</li>
                  <li><strong className="text-[var(--text-primary)]">Usage data</strong> — how you use the product (e.g., features used, build logs) to improve reliability and UX.</li>
                  <li><strong className="text-[var(--text-primary)]">Device and log data</strong> — IP address, browser type, and similar technical data for security and support.</li>
                </ul>
              </Section>

              <Section id="how-we-use" title="3. How We Use It">
                <p>
                  We use your data to provide, secure, and improve the Service; to communicate with you (e.g., product updates and support); to comply with law; and to enforce our terms. We may use aggregated or de-identified data for analytics and product development. We do not use your app content to train third-party AI models without your consent.
                </p>
              </Section>

              <Section id="sharing" title="4. Sharing">
                <p>
                  We do not sell your personal data. We may share data with service providers who help us operate the Service (e.g., hosting, analytics, email), under strict confidentiality and data-processing terms. We may also share data if required by law, to protect rights and safety, or in connection with a merger or sale of assets. We do not share your data with third parties for their marketing.
                </p>
              </Section>

              <Section id="cookies" title="5. Cookies">
                <p>
                  We use cookies and similar technologies for authentication, session management, and preferences (e.g., remembering your settings). Some are essential; others help us understand usage. You can control non-essential cookies via your browser settings. Blocking certain cookies may affect how the Service works.
                </p>
              </Section>

              <Section id="retention" title="6. Retention">
                <p>
                  We retain your data for as long as your account is active or as needed to provide the Service, resolve disputes, and comply with legal obligations. When you delete your account or request deletion, we will delete or anonymize your personal data within a reasonable period, except where we must retain it by law.
                </p>
              </Section>

              <Section id="security" title="7. Security">
                <p>
                  We use industry-standard measures to protect your data (e.g., encryption in transit and at rest, access controls). No system is completely secure; we encourage you to use a strong password and to notify us if you suspect unauthorized access to your account.
                </p>
              </Section>

              <Section id="your-rights" title="8. Your Rights">
                <p>
                  Depending on where you live, you may have the right to access, correct, delete, or port your data, or to object to or restrict certain processing. You can update account details in settings; for other requests, contact us at the address below. If you are in the EEA or UK, you may also lodge a complaint with your local data protection authority.
                </p>
              </Section>

              <Section id="children" title="9. Children">
                <p>
                  The Service is not intended for users under 16. We do not knowingly collect personal data from children. If you believe we have collected data from a child, please contact us and we will delete it promptly.
                </p>
              </Section>

              <Section id="changes" title="10. Changes">
                <p>
                  We may update this policy from time to time. We will post the new version on this page and update the &quot;Last updated&quot; date. Material changes may be communicated by email or in-product notice. Your continued use after the effective date constitutes acceptance. We encourage you to review this policy periodically.
                </p>
              </Section>

              <Section id="contact" title="11. Contact">
                <p>
                  For privacy-related questions or to exercise your rights, contact us at{" "}
                  <a href="mailto:privacy@vibetree.com" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
                    privacy@vibetree.com
                  </a>{" "}
                  or through our <Link href="/contact" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">contact page</Link>.
                </p>
              </Section>
            </div>
          </article>
        </div>
      </main>

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
      <div className="text-body-muted space-y-4 text-[var(--text-secondary)] [&>p]:leading-relaxed [&>ul]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
