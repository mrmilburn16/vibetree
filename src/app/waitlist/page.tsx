"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button, Card, Input } from "@/components/ui";
import { Check, Copy, ExternalLink } from "lucide-react";

const STORAGE_JOINED = "vibetree-waitlist-joined";
const STORAGE_TASKS = "vibetree-waitlist-tasks";

const TWEET_TEXT = "I just joined the waitlist for Vibetree — build real iOS apps in your browser with AI. No Xcode required. 🚀";
const TWEET_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`;
const FOLLOW_URL = "https://twitter.com/vibetree";
const POST_URL = "https://twitter.com/vibetree"; // Replace with actual launch post URL
const DISCORD_URL = "https://discord.gg/vibetree"; // Placeholder
const NEWSLETTER_URL = "/contact"; // Or your newsletter signup

type TaskId = "share" | "invite" | "like" | "follow" | "discord" | "newsletter";

const TASK_IDS: TaskId[] = ["share", "invite", "like", "follow", "discord", "newsletter"];

function loadTasks(): Record<TaskId, boolean> {
  if (typeof window === "undefined") return {} as Record<TaskId, boolean>;
  try {
    const raw = localStorage.getItem(STORAGE_TASKS);
    if (!raw) return {} as Record<TaskId, boolean>;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return TASK_IDS.reduce((acc, id) => ({ ...acc, [id]: !!parsed[id] }), {} as Record<TaskId, boolean>);
  } catch {
    return {} as Record<TaskId, boolean>;
  }
}

function saveTasks(tasks: Record<TaskId, boolean>) {
  try {
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks));
  } catch (_) {}
}

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<Record<TaskId, boolean>>({} as Record<TaskId, boolean>);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_JOINED);
      if (stored) {
        const data = JSON.parse(stored) as { email?: string; name?: string };
        if (data.email) {
          setJoined(true);
          setEmail(data.email || "");
          setName(data.name || "");
        }
      }
      setTasks(loadTasks());
    } catch (_) {}
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_JOINED, JSON.stringify({ email: trimmedEmail, name: name.trim() }));
      } catch (_) {}
      setJoined(true);
      setLoading(false);
    }, 600);
  }

  function markDone(id: TaskId) {
    const next = { ...tasks, [id]: true };
    setTasks(next);
    saveTasks(next);
  }

  function getReferralLink(): string {
    if (typeof window === "undefined") return "";
    let ref = "waitlist";
    try {
      ref = btoa(encodeURIComponent(email || "guest")).replace(/[+/=]/g, "").slice(0, 8) || ref;
    } catch (_) {}
    return `${window.location.origin}/waitlist?ref=${ref}`;
  }

  async function copyReferral() {
    const link = getReferralLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  const completedCount = TASK_IDS.filter((id) => tasks[id]).length;

  return (
    <div className="flex h-screen flex-col bg-[var(--background-primary)]">
      <Nav />
      <main className="landing-scroll-container flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Hero */}
        <section className="landing-section relative flex min-h-[50vh] flex-col justify-center overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 50% -20%, var(--button-primary-bg), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h1 className="text-heading-hero mb-4 animate-fade-in">
              Get earlier access
            </h1>
            <p className="text-body-muted animate-fade-in text-lg" style={{ animationDelay: "100ms" }}>
              Join the waitlist and move up by sharing, inviting friends, and following along. The more you do, the sooner you get in.
            </p>
            <a
              href="#join"
              className="mt-6 inline-block animate-fade-in"
              style={{ animationDelay: "200ms" }}
            >
              <Button variant="primary">Join the waitlist</Button>
            </a>
          </div>
        </section>

        {/* Join form */}
        <section id="join" className="landing-section px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-xl">
            {joined ? (
              <Card className="animate-fade-in py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--semantic-success)]/15">
                  <Check className="h-7 w-7 text-[var(--semantic-success)]" aria-hidden />
                </div>
                <h2 className="text-heading-card mb-2">You&apos;re on the list</h2>
                <p className="text-body-muted text-sm">
                  We&apos;ll email you at <strong className="text-[var(--text-primary)]">{mounted ? email : "…"}</strong> when your spot is ready.
                </p>
                <p className="text-caption mt-4 text-[var(--text-tertiary)]">
                  Complete the actions below to move up.
                </p>
              </Card>
            ) : (
              <Card className="animate-fade-in p-6 sm:p-8">
                <h2 className="text-heading-card mb-1">Join the waitlist</h2>
                <p className="text-body-muted mb-6 text-sm">
                  Enter your email to reserve your spot. You can move up by completing the actions below.
                </p>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label htmlFor="waitlist-email" className="text-body-muted mb-1.5 block text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="waitlist-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="waitlist-name" className="text-body-muted mb-1.5 block text-sm font-medium">
                      Name <span className="text-[var(--text-tertiary)]">(optional)</span>
                    </label>
                    <Input
                      id="waitlist-name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full"
                      autoComplete="name"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-[var(--semantic-error)]">{error}</p>
                  )}
                  <Button type="submit" variant="primary" disabled={loading} className="w-full sm:w-auto">
                    {loading ? "Joining…" : "Join the waitlist"}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </section>

        {/* Move up: tasks */}
        <section className="landing-section border-t border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-heading-section mb-2 text-center">Move up the list</h2>
            <p className="text-body-muted mb-8 text-center text-sm">
              Complete these actions to get earlier access. Your progress is saved.
            </p>
            {mounted && completedCount > 0 && (
              <p className="text-caption mb-6 text-center text-[var(--link-default)]">
                {completedCount} of {TASK_IDS.length} completed
              </p>
            )}
            <div className="space-y-4">
              {/* Share on Twitter */}
              <Card className={`p-4 sm:p-5 ${tasks.share ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Share on Twitter / X</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Share that you joined the waitlist</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tasks.share ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <a href={TWEET_URL} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" className="gap-1 text-xs px-3 py-1.5 min-h-0">
                            <ExternalLink className="h-3.5 w-3.5" /> Share
                          </Button>
                        </a>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("share")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Invite friends */}
              <Card className={`p-4 sm:p-5 ${tasks.invite ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Invite friends</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Share your referral link</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {tasks.invite ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          className="gap-1 text-xs px-3 py-1.5 min-h-0"
                          onClick={copyReferral}
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Copied" : "Copy link"}
                        </Button>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("invite")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {!tasks.invite && mounted && (
                  <p className="text-caption mt-3 truncate rounded bg-[var(--background-tertiary)] px-2 py-1.5 font-mono text-xs text-[var(--text-tertiary)]">
                    {getReferralLink()}
                  </p>
                )}
              </Card>

              {/* Like our post */}
              <Card className={`p-4 sm:p-5 ${tasks.like ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Like our launch post</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Like our post on Twitter / X</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tasks.like ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <a href={POST_URL} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" className="gap-1 text-xs px-3 py-1.5 min-h-0">
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </Button>
                        </a>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("like")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Follow us */}
              <Card className={`p-4 sm:p-5 ${tasks.follow ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Follow us on Twitter / X</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Follow @vibetree</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tasks.follow ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <a href={FOLLOW_URL} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" className="gap-1 text-xs px-3 py-1.5 min-h-0">
                            <ExternalLink className="h-3.5 w-3.5" /> Follow
                          </Button>
                        </a>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("follow")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Discord */}
              <Card className={`p-4 sm:p-5 ${tasks.discord ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Join our Discord</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Chat with the community</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tasks.discord ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" className="gap-1 text-xs px-3 py-1.5 min-h-0">
                            <ExternalLink className="h-3.5 w-3.5" /> Join
                          </Button>
                        </a>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("discord")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Newsletter */}
              <Card className={`p-4 sm:p-5 ${tasks.newsletter ? "opacity-90" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Subscribe to the newsletter</h3>
                    <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Get updates and early access news</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tasks.newsletter ? (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
                        <Check className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <>
                        <a href={NEWSLETTER_URL}>
                          <Button variant="secondary" className="gap-1 text-xs px-3 py-1.5 min-h-0">
                            <ExternalLink className="h-3.5 w-3.5" /> Subscribe
                          </Button>
                        </a>
                        <Button variant="ghost" className="text-xs px-3 py-1.5 min-h-0" onClick={() => markDone("newsletter")}>
                          I did it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
