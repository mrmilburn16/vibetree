"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "quick-start", label: "Quick start" },
  { id: "projects-dashboard", label: "Projects & dashboard" },
  { id: "the-editor", label: "The editor" },
  { id: "chat-and-ai", label: "Chat & AI" },
  { id: "preview-and-build", label: "Preview & build" },
  { id: "project-settings", label: "Project settings" },
  { id: "run-on-device", label: "Run on device" },
  { id: "publish", label: "Publish to App Store" },
  { id: "credits-billing", label: "Credits & billing" },
  { id: "api-reference", label: "API reference" },
  { id: "faq", label: "FAQ" },
];

function ChevronUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group">
      <pre>
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-2 py-1 text-xs text-[var(--text-secondary)] opacity-0 transition-opacity hover:bg-[var(--background-primary)] hover:text-[var(--text-primary)] group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-[var(--border-default)] py-8 first:pt-4 last:border-b-0">
      <h2 className="text-heading-card mb-4">{title}</h2>
      <div className="prose-docs text-[var(--text-secondary)] [&>p]:leading-relaxed [&>p]:mb-3">
        {children}
      </div>
    </section>
  );
}

export default function DocsPage() {
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
        <section className="relative overflow-hidden border-b border-[var(--border-default)] px-4 py-14 sm:px-6 sm:py-16">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--button-primary-bg), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-3xl">
            <nav className="text-caption mb-3 font-medium uppercase tracking-wider text-[var(--text-tertiary)]" aria-label="Breadcrumb">
              <Link href="/" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">Home</Link>
              <span className="mx-2" aria-hidden>/</span>
              <span>Documentation</span>
            </nav>
            <h1 className="text-heading-hero animate-fade-in mb-3">Documentation</h1>
            <p className="text-body-muted text-lg">
              Everything you need to build and ship iOS apps with Vibetree—from your first app to the App Store.
            </p>
          </div>
        </section>

        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:gap-12 lg:px-6 lg:py-14">
          {/* Sticky TOC — left for nav-then-content (docs pattern) */}
          <aside className="lg:sticky lg:top-24 lg:order-1 lg:w-56 lg:shrink-0" aria-label="On this page">
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
                      className={`block rounded-[var(--radius-sm)] py-1.5 px-2 text-sm transition-colors ${
                        activeId === id
                          ? "bg-[var(--button-primary-bg)]/15 text-[var(--link-default)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Article — content column; prose max-width keeps line length comfortable */}
          <article className="min-w-0 flex-1 lg:order-2">
            <DocSection id="introduction" title="Introduction">
              <p>
                Vibetree is a web-based iOS app builder. You describe your app in plain language; AI generates native Swift and SwiftUI code. You preview the app live in your browser, then run it on your iPhone or publish to the App Store—no Xcode required to get started.
              </p>
              <p>
                This documentation covers the full flow: creating projects, using the editor (chat, preview, settings), running on device, publishing, and how credits and billing work. We also include an API reference for programmatic access.
              </p>
            </DocSection>

            <DocSection id="quick-start" title="Quick start">
              <p>Get your first app running in three steps:</p>
              <ol>
                <li><strong>Sign up</strong> — Create an account at <Link href="/sign-up">Sign up</Link>. You can start on the free Creator plan.</li>
                <li><strong>Create a project</strong> — From the <Link href="/dashboard">dashboard</Link>, click <strong>New app</strong>. You’ll be taken to the editor.</li>
                <li><strong>Describe your app</strong> — In the chat panel, type what you want (e.g. “A todo list with due dates”). The AI will generate Swift code and you’ll see the build status and live preview.</li>
              </ol>
              <p>
                From there you can tweak the project name and bundle ID in <strong>Project settings</strong>, use <strong>Run on device</strong> to install on your iPhone, or <strong>Publish</strong> to submit to the App Store (on Pro or Team plans).
              </p>
            </DocSection>

            <DocSection id="projects-dashboard" title="Projects & dashboard">
              <p>
                The dashboard is your home for all apps. Each <strong>project</strong> has an ID, name, bundle identifier, and last-updated timestamp. Projects are listed as cards; you can open one to enter the editor or delete it (with confirmation).
              </p>
              <p>
                <strong>New app</strong> creates a project with a default name (e.g. “Untitled app”) and a generated bundle ID (e.g. <code>com.vibetree.&lt;slug&gt;</code>). You can change the name and bundle ID later in Project settings. Plan limits apply: Creator allows 1 app, Pro allows 5, Team allows unlimited apps.
              </p>
            </DocSection>

            <DocSection id="the-editor" title="The editor">
              <p>
                The editor is a single-page layout: <strong>Chat</strong> on the left (or top on small screens), <strong>Preview</strong> in the center with an optional device frame, and access to <strong>Project settings</strong>, <strong>Run on device</strong>, and <strong>Publish</strong> from the header or preview area.
              </p>
              <p>
                You describe changes or new features in natural language. The AI responds with suggested code edits and the project builds; when the build succeeds, the preview shows the live app state. Build status is shown in the chat header and in the preview pane (idle → building → live or failed).
              </p>
            </DocSection>

            <DocSection id="chat-and-ai" title="Chat & AI">
              <p>
                The chat panel is where you communicate with the AI. Type a message (e.g. “Add a login screen” or “Show a list of items from an API”) and send. Messages have a maximum length (4,000 characters). The AI model can be selected from the dropdown below the message input—options include Claude Opus 4.6, GPT-4o, GPT-4o mini, Claude Sonnet 4, and Claude 3.5 Haiku. Your choice is remembered in the browser.
              </p>
              <p>
                Model availability depends on your plan: Creator plan uses Claude 3.5 Haiku only; Pro and Team can use all models. Premium models consume more credits per message than standard models (see <a href="#credits-billing">Credits & billing</a>).
              </p>
              <p>
                After you send a message, the assistant may list edited files and the build will run. When the build finishes, the preview updates to show the live app or a failure state so you can iterate.
              </p>
            </DocSection>

            <DocSection id="preview-and-build" title="Preview & build">
              <p>
                The preview pane shows the current state of your app. Build status can be <strong>idle</strong>, <strong>building</strong>, <strong>live</strong>, or <strong>failed</strong>. When live, you see the running app (or a placeholder when using the mock flow). The preview can be wrapped in an optional device frame to simulate an iPhone.
              </p>
              <p>
                Each successful build consumes credits (see Credits & billing). If the build fails, you’ll see a failed state and can adjust your request and try again.
              </p>
            </DocSection>

            <DocSection id="project-settings" title="Project settings">
              <p>
                In Project settings you can change the <strong>project name</strong> and <strong>bundle identifier</strong>. The bundle ID must follow a valid format (e.g. <code>com.yourcompany.appname</code>). App icon can be set or generated (when that feature is available). Changes are saved to your project and reflected in the editor and dashboard.
              </p>
            </DocSection>

            <DocSection id="run-on-device" title="Run on device">
              <p>
                Run on device lets you install the app on your physical iPhone. The flow offers two paths: using a <strong>desktop agent</strong> on your Mac (download and run the agent, then connect your iPhone), or using <strong>TestFlight</strong> (get a link to install via TestFlight). Follow the instructions in the modal; both paths require your Mac for building and signing. This action consumes credits on Pro and Team plans.
              </p>
            </DocSection>

            <DocSection id="publish" title="Publish to App Store">
              <p>
                Publish walks you through submitting your app to the App Store. You sign in with your Apple Developer account (once); then for each submission you enter app name, version, and “What’s new.” The UI shows steps: archiving → uploading → processing → done. Submitting to the App Store consumes credits (see Credits & billing). Publishing is available on Pro and Team plans only.
              </p>
            </DocSection>

            <DocSection id="credits-billing" title="Credits & billing">
              <p>
                Vibetree uses a <strong>credit</strong> system for AI and build usage. One balance applies across all actions. Credits reset each billing period (monthly or annual); there is no rollover. When you run out, AI and builds are blocked until the next period or until you upgrade.
              </p>
              <p><strong>What consumes credits:</strong></p>
              <ul>
                <li>1 AI chat message (standard model, e.g. Claude 3.5 Haiku) — 1 credit</li>
                <li>1 AI chat message (premium model, e.g. Opus, GPT-4o) — 3 credits</li>
                <li>1 build (simulator preview / live) — 5 credits</li>
                <li>1 Run on device install — 10 credits</li>
                <li>1 App Store publish submission — 25 credits</li>
              </ul>
              <p>
                Plans: <strong>Creator</strong> (free) — 1 app, 50 credits/month, Haiku only. <strong>Pro</strong> — $29/mo or $290/yr, 5 apps, 500 credits/month, all models, Run on device, Publish, 14-day free trial. <strong>Team</strong> — $79/mo or $790/yr, unlimited apps, 2,000 credits/month, everything in Pro plus team seats and priority support. See <Link href="/pricing">Pricing</Link> for full details.
              </p>
            </DocSection>

            <DocSection id="api-reference" title="API reference">
              <p>
                Vibetree exposes REST-style API routes for projects and chat. Base URL is your app origin (e.g. <code>https://yourapp.com</code>). All project endpoints operate on the server-side project store; the dashboard and editor also use client-side project data from localStorage.
              </p>
              <p><strong>List projects</strong></p>
              <CodeBlock>GET /api/projects</CodeBlock>
              <p>Returns an array of projects for the current context.</p>
              <p><strong>Create project</strong></p>
              <CodeBlock>{`POST /api/projects
Content-Type: application/json
Body: { "name"?: string }`}</CodeBlock>
              <p>Creates a project; optional <code>name</code>. Returns the created project with <code>id</code>, <code>name</code>, <code>bundleId</code>, <code>updatedAt</code>.</p>
              <p><strong>Get project</strong></p>
              <CodeBlock>GET /api/projects/[id]</CodeBlock>
              <p>Returns a single project or 404.</p>
              <p><strong>Update project</strong></p>
              <CodeBlock>{`PATCH /api/projects/[id]
Content-Type: application/json
Body: { "name"?: string, "bundleId"?: string }`}</CodeBlock>
              <p>Updates the project; returns the updated project.</p>
              <p><strong>Send chat message</strong></p>
              <CodeBlock>{`POST /api/projects/[id]/message
Content-Type: application/json
Body: { "message": string }`}</CodeBlock>
              <p>Sends a message to the AI for that project. Returns an object with <code>assistantMessage</code> and <code>buildStatus</code>. Currently the implementation is mock (canned responses and build success).</p>
            </DocSection>

            <DocSection id="faq" title="FAQ">
              <p><strong>Do I need Xcode or a Mac?</strong></p>
              <p>You can sign up, create projects, and use the editor from any device. To run on a physical iPhone or publish to the App Store, a Mac is used for building and signing (via our infrastructure or the desktop agent).</p>
              <p><strong>What happens when I run out of credits?</strong></p>
              <p>AI chat and new builds are blocked until the next billing period or until you upgrade. You can still view existing projects and change settings.</p>
              <p><strong>Can I change my plan?</strong></p>
              <p>Yes. Upgrade or downgrade from the <Link href="/pricing">Pricing</Link> page. Upgrades take effect immediately; downgrades typically take effect at the end of the current billing period.</p>
              <p><strong>Is my app code private?</strong></p>
              <p>We use your content only to provide and improve the service. We do not use your app code to train third-party AI models without your consent. See our <Link href="/privacy">Privacy Policy</Link>.</p>
              <p><strong>Where can I get help?</strong></p>
              <p>Use our <Link href="/contact">Contact</Link> page for support, sales, or feedback. We aim to reply within 24 hours.</p>
            </DocSection>
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
