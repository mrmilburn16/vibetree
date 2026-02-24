"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button, Card, Input } from "@/components/ui";
import { Check, Copy, ExternalLink, Trophy, Clock, Users } from "lucide-react";

const STORAGE_TOKEN = "vibetree-waitlist-token";

const TWEET_TEXT =
  "I just joined the waitlist for Vibetree — build real iOS apps in your browser with AI. No Xcode required. 🚀";
const FOLLOW_URL = "https://twitter.com/vibetree";
const POST_URL = "https://twitter.com/vibetree";
const THREADS_URL = "https://threads.net/@vibetree";
const DISCORD_URL = "https://discord.gg/vibetree";
const NEWSLETTER_URL = "/contact";

type ActionId = "share" | "follow_x" | "follow_threads" | "like" | "discord" | "newsletter" | "invite";

const ACTION_POINTS: Record<ActionId, number> = {
  share: 300,
  follow_x: 200,
  follow_threads: 150,
  like: 100,
  discord: 200,
  newsletter: 150,
  invite: 500,
};

type WaitlistStatus = {
  token: string;
  email: string;
  name: string;
  referralCode: string;
  position: number;
  signupPosition: number;
  points: number;
  completedActions: string[];
  abVariant: "a" | "b";
};

type LeaderboardEntry = { rank: number; displayName: string; points: number };

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function getReferralParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ref");
}

// ── Countdown timer for action verification ──────────────────────────────────
function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRemaining(seconds);
    setActive(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setActive(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [seconds]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { remaining, active, start };
}

// ── Task card ────────────────────────────────────────────────────────────────
function TaskCard({
  id,
  title,
  description,
  points,
  done,
  actionHref,
  actionLabel,
  onVerify,
}: {
  id: ActionId;
  title: string;
  description: string;
  points: number;
  done: boolean;
  actionHref?: string;
  actionLabel: string;
  onVerify: (id: ActionId) => Promise<void>;
}) {
  const { remaining, active, start } = useCountdown(15);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    await onVerify(id);
    setVerifying(false);
  }

  function handleOpen() {
    start();
  }

  return (
    <Card className={`p-4 sm:p-5 transition-opacity ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
            <span className="rounded-full bg-[var(--button-primary-bg)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--link-default)]">
              +{points} pts
            </span>
          </div>
          <p className="text-caption mt-0.5 text-[var(--text-secondary)]">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {done ? (
            <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
              <Check className="h-4 w-4" /> Done
            </span>
          ) : (
            <>
              {actionHref ? (
                <a href={actionHref} target="_blank" rel="noopener noreferrer" onClick={handleOpen}>
                  <Button variant="secondary" className="gap-1 px-3 py-1.5 text-xs min-h-0">
                    <ExternalLink className="h-3.5 w-3.5" /> {actionLabel}
                  </Button>
                </a>
              ) : null}
              {active ? (
                <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Clock className="h-3.5 w-3.5" /> {remaining}s…
                </span>
              ) : (
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs min-h-0"
                  disabled={verifying}
                  onClick={handleVerify}
                >
                  {verifying ? "Saving…" : "I did it"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({
  top10,
  userRank,
}: {
  top10: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
}) {
  if (top10.length === 0) return null;

  const userInTop10 = userRank && top10.some((e) => e.rank === userRank.rank);

  return (
    <section className="landing-section border-t border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-[var(--link-default)]" />
          <h2 className="text-heading-section">Leaderboard</h2>
        </div>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-xs text-[var(--text-tertiary)]">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((entry) => (
                <tr
                  key={entry.rank}
                  className={`border-b border-[var(--border-default)] last:border-0 ${
                    userRank && entry.rank === userRank.rank
                      ? "bg-[var(--button-primary-bg)]/10"
                      : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-[var(--text-tertiary)]">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-primary)]">{entry.displayName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--link-default)] font-semibold">
                    {entry.points.toLocaleString()}
                  </td>
                </tr>
              ))}
              {userRank && !userInTop10 && (
                <>
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-center text-xs text-[var(--text-tertiary)]">
                      · · ·
                    </td>
                  </tr>
                  <tr className="bg-[var(--button-primary-bg)]/10">
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-[var(--text-tertiary)]">
                      {userRank.rank}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{userRank.displayName} (you)</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--link-default)] font-semibold">
                      {userRank.points.toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  // Hydrate from server on load if token exists
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (token) {
      fetchStatus(token);
      fetchLeaderboard(token);
    } else {
      fetchLeaderboard(null);
    }
  }, []);

  async function fetchStatus(token: string) {
    try {
      const res = await fetch(`/api/waitlist/status?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = (await res.json()) as WaitlistStatus;
      setStatus(data);
      setEmail(data.email);
      setName(data.name);
      setJoined(true);
    } catch (_) {}
  }

  async function fetchLeaderboard(token: string | null) {
    try {
      const url = token
        ? `/api/waitlist/leaderboard?token=${encodeURIComponent(token)}`
        : "/api/waitlist/leaderboard";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as { top10: LeaderboardEntry[]; userRank: LeaderboardEntry | null };
      setTop10(data.top10);
      setUserRank(data.userRank);
    } catch (_) {}
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const abVariant = (getCookie("ab_variant") ?? "a") as "a" | "b";
      const ref = getReferralParam();
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: name.trim(), ref, abVariant }),
      });

      const data = (await res.json()) as {
        token?: string;
        position?: number;
        points?: number;
        referralCode?: string;
        error?: string;
        alreadyJoined?: boolean;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.token) {
        localStorage.setItem(STORAGE_TOKEN, data.token);
        await fetchStatus(data.token);
        await fetchLeaderboard(data.token);
      }
      setJoined(true);
    } catch (_) {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(actionId: ActionId) {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    try {
      const res = await fetch("/api/waitlist/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: actionId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        points: number;
        completedActions: string[];
        position: number;
      };
      setStatus((prev) =>
        prev
          ? { ...prev, points: data.points, completedActions: data.completedActions, position: data.position }
          : prev
      );
      await fetchLeaderboard(token);
    } catch (_) {}
  }

  function getReferralLink(): string {
    if (typeof window === "undefined" || !status) return "";
    return `${window.location.origin}/waitlist?ref=${status.referralCode}`;
  }

  function getTweetUrl(): string {
    const ref = status?.referralCode;
    const link = ref ? ` ${window.location.origin}/waitlist?ref=${ref}` : "";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT + link)}`;
  }

  async function copyReferral() {
    const link = getReferralLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  const completedActions = status?.completedActions ?? [];
  const isDone = (id: ActionId) => completedActions.includes(id);

  // Variant B: leaderboard above the fold, referral first in task list
  const abVariant = mounted ? (getCookie("ab_variant") ?? "a") : "a";

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
            <h1 className="text-heading-hero mb-4 animate-fade-in">Get earlier access</h1>
            <p
              className="text-body-muted animate-fade-in text-lg"
              style={{ animationDelay: "100ms" }}
            >
              Join the waitlist and move up by sharing, inviting friends, and following along. The more you do, the
              sooner you get in.
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

        {/* Variant B: leaderboard above join form */}
        {abVariant === "b" && top10.length > 0 && (
          <Leaderboard top10={top10} userRank={userRank} />
        )}

        {/* Join form / confirmation */}
        <section id="join" className="landing-section px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-xl">
            {joined && status ? (
              <Card className="animate-fade-in py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--semantic-success)]/15">
                  <Check className="h-7 w-7 text-[var(--semantic-success)]" aria-hidden />
                </div>
                <h2 className="text-heading-card mb-1">You&apos;re on the list</h2>
                <p className="text-body-muted text-sm">
                  We&apos;ll email you at{" "}
                  <strong className="text-[var(--text-primary)]">{mounted ? email : "…"}</strong> when your spot is
                  ready.
                </p>

                {/* Position + points */}
                <div className="mt-6 flex justify-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">#{status.position}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">in line</p>
                  </div>
                  <div className="w-px bg-[var(--border-default)]" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--link-default)] tabular-nums">
                      {status.points.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">points</p>
                  </div>
                </div>

                {/* Referral link */}
                <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--background-tertiary)] px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Your referral link</p>
                  <p className="mb-2 truncate font-mono text-xs text-[var(--text-tertiary)]">{getReferralLink()}</p>
                  <Button variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs min-h-0" onClick={copyReferral}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy link"}
                  </Button>
                </div>

                <p className="text-caption mt-4 text-[var(--text-tertiary)]">
                  Complete the actions below to move up the list.
                </p>
              </Card>
            ) : (
              <Card className="animate-fade-in p-6 sm:p-8">
                <h2 className="text-heading-card mb-1">Join the waitlist</h2>
                <p className="text-body-muted mb-6 text-sm">
                  Enter your email to reserve your spot. Complete actions below to move up.
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
                  {error && <p className="text-sm text-[var(--semantic-error)]">{error}</p>}
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
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-heading-section">Move up the list</h2>
              {mounted && completedActions.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--link-default)]">
                  <Users className="h-4 w-4" />
                  {completedActions.length - 1} / 7 done
                </span>
              )}
            </div>
            <p className="text-body-muted mb-8 text-sm">
              Click an action, wait 15 seconds, then hit &quot;I did it&quot; to earn points and move up.
            </p>
            <div className="space-y-4">
              {abVariant === "b" ? (
                // Variant B order: invite first
                <>
                  <InviteCard done={isDone("invite")} referralLink={getReferralLink()} copied={copied} onCopy={copyReferral} onVerify={handleAction} />
                  <TaskCard id="share" title="Share on Twitter / X" description="Share that you joined the waitlist" points={ACTION_POINTS.share} done={isDone("share")} actionHref={getTweetUrl()} actionLabel="Share" onVerify={handleAction} />
                  <TaskCard id="follow_x" title="Follow us on Twitter / X" description="Follow @vibetree" points={ACTION_POINTS.follow_x} done={isDone("follow_x")} actionHref={FOLLOW_URL} actionLabel="Follow" onVerify={handleAction} />
                  <TaskCard id="follow_threads" title="Follow us on Threads" description="Follow @vibetree on Threads" points={ACTION_POINTS.follow_threads} done={isDone("follow_threads")} actionHref={THREADS_URL} actionLabel="Follow" onVerify={handleAction} />
                  <TaskCard id="discord" title="Join our Discord" description="Chat with the community" points={ACTION_POINTS.discord} done={isDone("discord")} actionHref={DISCORD_URL} actionLabel="Join" onVerify={handleAction} />
                  <TaskCard id="newsletter" title="Subscribe to the newsletter" description="Get updates and early access news" points={ACTION_POINTS.newsletter} done={isDone("newsletter")} actionHref={NEWSLETTER_URL} actionLabel="Subscribe" onVerify={handleAction} />
                  <TaskCard id="like" title="Like our launch post" description="Like our post on Twitter / X" points={ACTION_POINTS.like} done={isDone("like")} actionHref={POST_URL} actionLabel="Open" onVerify={handleAction} />
                </>
              ) : (
                // Variant A order: share first
                <>
                  <TaskCard id="share" title="Share on Twitter / X" description="Share that you joined the waitlist" points={ACTION_POINTS.share} done={isDone("share")} actionHref={getTweetUrl()} actionLabel="Share" onVerify={handleAction} />
                  <InviteCard done={isDone("invite")} referralLink={getReferralLink()} copied={copied} onCopy={copyReferral} onVerify={handleAction} />
                  <TaskCard id="follow_x" title="Follow us on Twitter / X" description="Follow @vibetree" points={ACTION_POINTS.follow_x} done={isDone("follow_x")} actionHref={FOLLOW_URL} actionLabel="Follow" onVerify={handleAction} />
                  <TaskCard id="follow_threads" title="Follow us on Threads" description="Follow @vibetree on Threads" points={ACTION_POINTS.follow_threads} done={isDone("follow_threads")} actionHref={THREADS_URL} actionLabel="Follow" onVerify={handleAction} />
                  <TaskCard id="discord" title="Join our Discord" description="Chat with the community" points={ACTION_POINTS.discord} done={isDone("discord")} actionHref={DISCORD_URL} actionLabel="Join" onVerify={handleAction} />
                  <TaskCard id="newsletter" title="Subscribe to the newsletter" description="Get updates and early access news" points={ACTION_POINTS.newsletter} done={isDone("newsletter")} actionHref={NEWSLETTER_URL} actionLabel="Subscribe" onVerify={handleAction} />
                  <TaskCard id="like" title="Like our launch post" description="Like our post on Twitter / X" points={ACTION_POINTS.like} done={isDone("like")} actionHref={POST_URL} actionLabel="Open" onVerify={handleAction} />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Variant A: leaderboard below tasks */}
        {abVariant !== "b" && <Leaderboard top10={top10} userRank={userRank} />}

        <Footer />
      </main>
    </div>
  );
}

// ── Inline invite card (handles copy + verify) ───────────────────────────────
function InviteCard({
  done,
  referralLink,
  copied,
  onCopy,
  onVerify,
}: {
  done: boolean;
  referralLink: string;
  copied: boolean;
  onCopy: () => void;
  onVerify: (id: ActionId) => Promise<void>;
}) {
  const { remaining, active, start } = useCountdown(15);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    await onVerify("invite");
    setVerifying(false);
  }

  return (
    <Card className={`p-4 sm:p-5 transition-opacity ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Invite friends</h3>
            <span className="rounded-full bg-[var(--button-primary-bg)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--link-default)]">
              +{ACTION_POINTS.invite} pts / referral
            </span>
          </div>
          <p className="text-caption mt-0.5 text-[var(--text-secondary)]">Share your referral link</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {done ? (
            <span className="flex items-center gap-1.5 text-sm text-[var(--semantic-success)]">
              <Check className="h-4 w-4" /> Done
            </span>
          ) : (
            <>
              <Button
                variant="secondary"
                className="gap-1 px-3 py-1.5 text-xs min-h-0"
                onClick={() => { onCopy(); start(); }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              {active ? (
                <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Clock className="h-3.5 w-3.5" /> {remaining}s…
                </span>
              ) : (
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs min-h-0"
                  disabled={verifying}
                  onClick={handleVerify}
                >
                  {verifying ? "Saving…" : "I did it"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {!done && referralLink && (
        <p className="text-caption mt-3 truncate rounded bg-[var(--background-tertiary)] px-2 py-1.5 font-mono text-xs text-[var(--text-tertiary)]">
          {referralLink}
        </p>
      )}
    </Card>
  );
}
