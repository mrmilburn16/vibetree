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
  { id: "testflight-invites", label: "TestFlight invites" },
  { id: "publish", label: "Publish to App Store" },
  { id: "credits-billing", label: "Credits & billing" },
  { id: "live-activities", label: "Live Activities" },
  { id: "liquid-glass", label: "Liquid Glass (iOS 26)" },
  { id: "app-clips", label: "App Clips" },
  { id: "integrations", label: "Integrations" },
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
                From there you can tweak the project name and bundle ID in <strong>Project settings</strong>, use <strong>Run on device</strong> to preview on your iPhone with Expo Go, use <strong>Share</strong> to get a TestFlight link or invite testers, or <strong>Publish</strong> to submit to the App Store (on Pro or Team plans).
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
                The editor is a single-page layout: <strong>Chat</strong> on the left (or top on small screens), <strong>Preview</strong> in the center with an optional device frame, and access to <strong>Project settings</strong>, <strong>Run on device</strong>, <strong>Share</strong>, and <strong>Publish</strong> from the header or preview area.
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
                <strong>Standard (Expo)</strong> projects get a live in-browser preview: we run an Expo dev server and show a QR code; scan with Expo Go to see the app on your phone. <strong>Pro (Swift/SwiftUI)</strong> builds native iOS code—SwiftUI does not run in the browser, so there is no in-browser simulator. When a Pro build is live, use <strong>Run on device</strong> to download the Xcode project, then open it in Xcode and run on the iOS Simulator or a physical iPhone to preview. We may add a static screenshot from the Mac build runner after each successful Pro build in a future update; a full live stream of the simulator in the browser would require separate infrastructure (e.g. a cloud simulator service).
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
                <strong>Run on device</strong> is for previewing your app on your iPhone with <strong>Expo Go</strong>. Scan a QR code with your iPhone (camera or Expo Go app); your app loads in Expo Go with no install step and no Apple Developer account. We generate an Expo/React Native version of your app and serve it; the QR encodes the URL.
              </p>
              <p>
                A small Expo Go QR strip appears in the <strong>Preview</strong> pane below the device frame so you can scan without opening a modal. Use the header button &quot;Run on device&quot; to open a modal with a larger QR if you prefer. Run on device (Expo Go) consumes credits on Pro and Team plans.
              </p>
            </DocSection>

            <DocSection id="testflight-invites" title="TestFlight invites">
              <p>
                The <strong>Share</strong> modal (header button &quot;Share&quot;) is where you get a TestFlight link, invite testers by email, or install via the desktop agent. <strong>Get TestFlight link</strong> — we build your app and give you a link (and QR code) to install via TestFlight; no Mac required. <strong>Invite testers</strong> — enter one or more email addresses (comma- or newline-separated) and click <strong>Send invites</strong>; we add them as external testers and send Apple&apos;s TestFlight invitation email. A build must already be in TestFlight (e.g. after you&apos;ve used &quot;Get TestFlight link&quot;) for invites to work. <strong>Desktop agent for Mac</strong> — download the agent and connect your iPhone via cable to install the app directly.
              </p>
            </DocSection>

            <DocSection id="publish" title="Publish to App Store">
              <p>
                Publish walks you through submitting your app to the App Store. You sign in with your Apple Developer account (once); then for each submission you enter app name, version, and “What’s new.” The UI shows steps: archiving → uploading → processing → done. Submitting to the App Store consumes credits (see Credits & billing). Publishing is available on Pro and Team plans only.
              </p>
              <p>
                We show an <strong>up-to-date community average</strong> of how long it typically takes from submission until your app is live on the store (e.g. &quot;Our users&apos; apps typically go live within 2 days of submitting&quot;). This appears before you submit (under the form) and after submission on the done step. If we don&apos;t have enough data yet, we show a fallback message (e.g. &quot;Apple review usually takes 24–48 hours&quot;).
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

            <DocSection id="live-activities" title="Live Activities">
              <p>
                <strong>Live Activities</strong> show real-time app data on the iPhone Lock Screen and Dynamic Island (e.g. timer, delivery status, sports score). They are built with ActivityKit and WidgetKit and can be updated from your app or via push notifications.
              </p>
              <p>
                You can ask the AI to add a Live Activity to your app—for example, &quot;Add a Live Activity for order tracking&quot; or &quot;Show delivery status on the Lock Screen.&quot; The AI will generate the Swift code (ActivityAttributes, Widget Extension, update calls). Your app can then show live updates without the user opening the app. This is available when your project targets a supported iOS version (e.g. iOS 16.1+ for Dynamic Island on iPhone 14 Pro and later).
              </p>
            </DocSection>

            <DocSection id="liquid-glass" title="Liquid Glass (iOS 26)">
              <p>
                <strong>Liquid Glass</strong> is Apple&apos;s new design system introduced at WWDC 2025. It uses translucent, reflective materials that react to light and input, giving apps a modern look consistent with iOS 26.
              </p>
              <p>
                When your app targets iOS 26 (or &quot;latest&quot;), you can ask the AI to use Liquid Glass in the generated UI—for example, &quot;Use Liquid Glass design&quot; or by choosing a project option. The AI will apply SwiftUI APIs such as <code>.glassEffect()</code> and related modifiers so your app matches the latest system style. No changes to the Vibetree web UI are required; this is handled in the generated Swift code and build pipeline.
              </p>
            </DocSection>

            <DocSection id="app-clips" title="App Clips">
              <p>
                <strong>App Clips</strong> are small, discoverable portions of your app that let users complete a specific task without downloading the full app (e.g. pay for parking, order one item). They can be invoked via NFC, QR codes, links in Safari or Messages, or App Clip codes.
              </p>
              <p>
                App Clips are an advanced feature. After Run on device and Publish work well, we plan to offer an &quot;Add an App Clip&quot; option in project settings. The AI would generate a separate App Clip target and a minimal flow (e.g. one URL that shows a simple view). Use cases include sign-up, one-off payment, or redeem offer. For now, App Clips are on the roadmap; you can build and ship your main app first.
              </p>
            </DocSection>

            <DocSection id="integrations" title="Integrations">
              <p>
                Vibetree can add common capabilities to your app with minimal steps. Ask the AI in chat or use the options below. These integrations turn difficult setup into one or a few actions.
              </p>
              <ul className="space-y-4">
                <li>
                  <strong>Sign in with Apple</strong> — One-click add Sign in with Apple to your app. In chat, say &quot;Add Sign in with Apple.&quot; The AI generates the capability and Swift code. You&apos;ll need to configure your App ID and Services ID in the Apple Developer account; we document the steps.
                </li>
                <li>
                  <strong>Push notifications</strong> — Say &quot;Enable push&quot; and the AI adds the push entitlement and registration code. We can create or revoke an APNs key and associate it with your app; a &quot;Send test notification&quot; button in Vibetree lets you verify delivery.
                </li>
                <li>
                  <strong>In-app purchase / StoreKit</strong> — Ask for &quot;Add a paywall&quot; or &quot;Add a tip jar.&quot; The AI generates Swift using StoreKit 2. We provide a guide for creating products in App Store Connect; an optional server can validate receipts if needed.
                </li>
                <li>
                  <strong>Deep link / Universal Link</strong> — Share your app at a link like <code>vibetree.app/go/myapp</code>; we host the redirect to the App Store or TestFlight. We can also help with AASA (apple-app-site-association) so your app opens from links.
                </li>
                <li>
                  <strong>Analytics (privacy-safe)</strong> — Optional one-click &quot;Add basic analytics&quot;: we add a lightweight event API and the AI inserts minimal logging. You get a dashboard placeholder or export of events.
                </li>
                <li>
                  <strong>Siri / App Intents</strong> — Say &quot;Add Siri Shortcuts&quot; so users can say &quot;Hey Siri, add to [app].&quot; The AI generates App Intents and donation calls. We document how to test and ship them.
                </li>
                <li>
                  <strong>Export or clone project</strong> — In <strong>Project settings</strong>, use <strong>Download source</strong> to get a Swift file of your project (or a ZIP when we have full generated source). On the dashboard, use <strong>Duplicate</strong> on a project card to create a copy and open it in the editor. Builds trust and gives you an escape hatch to Xcode.
                </li>
              </ul>
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
              <p><strong>Run on device URLs</strong></p>
              <CodeBlock>GET /api/projects/[id]/run-on-device</CodeBlock>
              <p>Returns <code>expoUrl</code> and <code>testFlightLink</code> for the project. <code>expoUrl</code> is used in the preview pane and Run on device modal (Expo Go QR); <code>testFlightLink</code> is used in the Share modal. Mock implementation returns placeholder URLs; production will trigger or look up builds.</p>
              <p><strong>Invite TestFlight testers</strong></p>
              <CodeBlock>{`POST /api/projects/[id]/invite-testers
Content-Type: application/json
Body: { "emails": string[] }`}</CodeBlock>
              <p>Adds the given emails as external testers and sends TestFlight invitations. Returns <code>success</code>, <code>invited</code> count, and <code>message</code>. Production will call App Store Connect API.</p>
              <p><strong>Community average: submit to live</strong></p>
              <CodeBlock>GET /api/publish/community-average</CodeBlock>
              <p>Returns <code>averageDays</code> and <code>sampleSize</code> for how long Vibetree users&apos; apps typically take from submission to App Store live. Used in the Publish modal to set expectations. When <code>sampleSize</code> is 0, the UI shows a fallback message.</p>
              <p><strong>Export project source</strong></p>
              <CodeBlock>GET /api/projects/[id]/export</CodeBlock>
              <p>Returns the project&apos;s source as a downloadable Swift file (e.g. <code>Content-Disposition: attachment</code>). Mock implementation returns a placeholder; production returns the full generated Swift or a ZIP of the project.</p>
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
