"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/landing/Footer";
import { Button, Card, Input } from "@/components/ui";
import { Check, Copy, ExternalLink, Trophy, Clock, Users, ChevronDown, Crown, Medal, Star, Gift, Zap, MessageCircle, Smartphone, Wrench, Eye, Cloud, Store, Flame, Sun, CloudSun, Sunset, Paperclip, Send } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono" });

const LAUNCH_DATE = new Date("2026-04-15T00:00:00Z");

const STORAGE_TOKEN = "vibetree-waitlist-token";

const TWEET_TEXT =
  "I just joined the waitlist for Vibetree — build real iOS apps in your browser with AI. No Xcode required.";
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
  referralCount: number;
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

// ── Launch countdown (April 15, 2026) ────────────────────────────────────────
function useLaunchCountdown() {
  const [diff, setDiff] = useState<number | null>(null);
  useEffect(() => {
    function tick() {
      const now = Date.now();
      const d = LAUNCH_DATE.getTime() - now;
      setDiff(d <= 0 ? 0 : d);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (diff === null) return { live: false, days: 0, hours: 0, mins: 0, secs: 0 };
  if (diff <= 0) return { live: true, days: 0, hours: 0, mins: 0, secs: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  return { live: false, days, hours, mins, secs };
}

// ── Minimal nav (logo + nav links + Join Waitlist) ─────────────────────────────
type SessionUser = { uid: string; email: string | null } | null;
function WaitlistMinimalNav({ glassMode }: { glassMode: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.ok ? res.json() : {})
      .then((data: { user?: SessionUser }) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function handleSignOut(e: React.MouseEvent) {
    e.preventDefault();
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    setUser(null);
    router.push("/waitlist");
    router.refresh();
  }

  function scrollToJoin() {
    document.getElementById("join")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-shadow ${
        glassMode ? "waitlist-nav-glass" : "border-[var(--border-default)] bg-[var(--background-primary)]/85 backdrop-blur-md"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/waitlist" className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90 shrink-0">
          Vibetree
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/waitlist#features"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            Features
          </Link>
          <Link
            href="/waitlist#how-it-works"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--link-default)]"
          >
            Pricing
          </Link>
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Button variant="primary" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="primary">Get started</Button>
              </Link>
            </>
          )}
          <Button variant="primary" className="shrink-0" onClick={scrollToJoin}>
            Join Waitlist
          </Button>
        </div>
      </nav>
    </header>
  );
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
  showIdidIt,
}: {
  id: ActionId;
  title: string;
  description: string;
  points: number;
  done: boolean;
  actionHref?: string;
  actionLabel: string;
  onVerify: (id: ActionId) => Promise<void>;
  showIdidIt: boolean;
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
    <Card className={`waitlist-action-card p-4 sm:p-5 transition-opacity ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
            <span className="rounded-full bg-[var(--link-default)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--link-default)]">
              +{points} pts
            </span>
          </div>
          <p className="text-caption mt-0.5 text-[var(--text-secondary)]">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {done ? (
            <span className="flex items-center gap-1.5 text-sm text-[var(--link-default)]">
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
              {showIdidIt ? (
                active ? (
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
                )
              ) : (
                <span className="text-xs text-[var(--text-tertiary)]">Open link, then return here</span>
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
                      ? "bg-[var(--link-default)]/10"
                      : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-[var(--text-tertiary)]">
                    {entry.rank <= 3 ? <Medal className="inline-block h-4 w-4 text-[var(--link-default)]" aria-hidden /> : entry.rank}
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
                  <tr className="bg-[var(--link-default)]/10">
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

// ── Scroll reveal hook ──────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Showcase YouTube-Shorts-style scroll hijack (wheel + touch) ───────────────
// Any wheel/swipe event while on a showcase panel immediately snaps to the
// next or previous panel — exactly one panel at a time.
//
// Root cause of multi-skip: Mac trackpads fire wheel events for 800ms+ after a
// single swipe. The fix uses TWO locks:
//   isSnapping  — true while scrollTo animation is in flight (~700ms)
//   snapCooldown — true from first wheel event until 150ms after the LAST wheel
//                  event of that gesture. This outlasts the animation and covers
//                  the entire swipe, so a hard flick can never skip two panels.
function useShowcaseSnap() {
  useEffect(() => {
    const scrollEl = document.querySelector(".waitlist-scroll-container") as HTMLElement | null;
    if (!scrollEl) return;
    const el = scrollEl;

    let isSnapping = false;
    let snapCooldown = false;
    let wheelEndTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartY = 0;
    let touchStartTime = 0;

    // Returns all snappable sections in DOM order: hero first, then showcase panels.
    function getPanels(): HTMLElement[] {
      return Array.from(document.querySelectorAll("[data-snap-section]")) as HTMLElement[];
    }

    // Returns the index of the snap section the user is currently aligned with
    // (0 = hero, 1-4 = showcase panels), or -1 if past the last snap section.
    function getActiveIndex(): number {
      const panels = getPanels();
      if (!panels.length) return -1;
      const scrollTop = el.scrollTop;
      const lastPanel = panels[panels.length - 1]!;
      const lastBottom = lastPanel.offsetTop + lastPanel.offsetHeight;

      // Only intercept within the snappable range (hero through last showcase panel)
      if (scrollTop > lastBottom - 4) return -1;

      // Find the section whose top is closest to current scroll position
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < panels.length; i++) {
        const dist = Math.abs(scrollTop - panels[i]!.offsetTop);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    function snapToIndex(index: number) {
      const panels = getPanels();
      if (index < 0 || index >= panels.length) return;
      isSnapping = true;
      snapCooldown = true;
      el.scrollTo({ top: panels[index]!.offsetTop, behavior: "smooth" });

      // Release isSnapping only once scrolling has truly stopped — detected by
      // receiving no scroll events for 100ms. This matches the actual animation
      // duration rather than guessing with a fixed timer.
      let settleTimer: ReturnType<typeof setTimeout> | null = null;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      function finish() {
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        el.removeEventListener("scroll", onAnimScroll);
        isSnapping = false;
      }

      function onAnimScroll() {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(finish, 100);
      }

      el.addEventListener("scroll", onAnimScroll, { passive: true });

      // Fallback: if scrollTo fires no scroll events (already at target, distance ≈ 0)
      fallbackTimer = setTimeout(finish, 1000);
    }

    function handleWheel(e: WheelEvent) {
      const idx = getActiveIndex();
      if (idx === -1) return; // Outside showcase — free scroll

      const panels = getPanels();
      const goingDown = e.deltaY > 0;

      // At boundary panels going outward → release control, let page scroll normally
      if (goingDown && idx === panels.length - 1) return;
      if (!goingDown && idx === 0) return;

      // Inside showcase going inward → take control
      e.preventDefault();

      // Reset gesture-end timer on every wheel event.
      // snapCooldown clears only 150ms after the last wheel event of this gesture,
      // which prevents a hard flick from firing multiple snaps.
      if (wheelEndTimer) clearTimeout(wheelEndTimer);
      wheelEndTimer = setTimeout(() => {
        snapCooldown = false;
        wheelEndTimer = null;
      }, 150);

      if (isSnapping || snapCooldown) return;

      snapToIndex(goingDown ? idx + 1 : idx - 1);
    }

    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
      touchStartTime = Date.now();
    }

    function handleTouchEnd(e: TouchEvent) {
      const idx = getActiveIndex();
      if (idx === -1) return;

      const touchEndY = e.changedTouches[0]?.clientY ?? 0;
      const diff = touchStartY - touchEndY; // positive = swipe up (scroll down)
      const elapsed = Date.now() - touchStartTime;

      // Require a deliberate swipe: ≥30px, ≤500ms
      if (Math.abs(diff) < 30 || elapsed > 500) return;

      const panels = getPanels();
      const goingDown = diff > 0;
      if (goingDown && idx === panels.length - 1) return;
      if (!goingDown && idx === 0) return;

      if (isSnapping) return;
      snapToIndex(goingDown ? idx + 1 : idx - 1);
    }

    // passive: false is required to call preventDefault() on wheel
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
      if (wheelEndTimer) clearTimeout(wheelEndTimer);
    };
  }, []);
}

// ── App showcase panels (4 apps, alternating layout, fade-in) ───────────────
const SHOWCASE_APPS = [
  {
    id: "habit",
    number: "01",
    title: "Plant Identifier",
    description: "Take a photo, identify any plant instantly — with care tips, watering schedules, and a personal collection. Generated from a single prompt.",
    prompt: "\"Create a plant identifier app. I take a photo using the camera, send it to a vision API proxy, and display the identified plant name, care tips, and watering schedule. Save identified plants to a collection.\"",
    videoSrc: "/videos/habit-tracker-demo.mp4",
  },
  {
    id: "hiit",
    number: "02",
    title: "HIIT Timer",
    description: "A high-intensity interval timer with animated countdown rings, customizable work/rest periods, exercise names, and haptic feedback on transitions.",
    prompt: "\"A HIIT workout timer with customizable rounds, rest periods, and exercise labels. Dark theme with a neon green accent\"",
    videoSrc: undefined as string | undefined, // e.g. "/videos/hiit-timer-demo.mp4"
  },
  {
    id: "budget",
    number: "03",
    title: "Budget Tracker",
    description: "A personal finance dashboard with monthly spending charts, category breakdowns, and a clean data-rich interface — all from one sentence.",
    prompt: "\"A budget tracker with monthly spending charts, category breakdowns, and a dark purple dashboard theme\"",
    videoSrc: undefined as string | undefined, // e.g. "/videos/budget-tracker-demo.mp4"
  },
  {
    id: "weather",
    number: "04",
    title: "Weather App",
    description: "A beautiful weather app with current conditions, hourly forecast, and atmospheric details — with a gradient sky that shifts based on time of day.",
    prompt: "\"A weather app with hourly forecasts, current conditions, and a gradient background that changes with the weather\"",
    videoSrc: undefined as string | undefined, // e.g. "/videos/weather-demo.mp4"
  },
];

// Static prompt input bar (glass pill, no animation)
function StaticPromptBar({ promptText }: { promptText: string }) {
  return (
    <div
      className="mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3"
      style={{
        borderRadius: 16,
        background: "rgba(22,32,30,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-30" aria-hidden />
      <div className={`min-h-[24px] flex-1 font-normal text-[var(--text-primary)] ${jetbrainsMono.className}`} style={{ fontSize: 14 }}>
        {promptText}
      </div>
      <div
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--link-default)" }}
      >
        <Send className="h-4 w-4 text-[var(--button-primary-text)]" aria-hidden />
      </div>
    </div>
  );
}

function WaitlistShowcase() {
  useShowcaseSnap();
  return (
    <>
      {SHOWCASE_APPS.map((app, index) => (
        <AppShowcasePanel key={app.id} app={app} index={index} />
      ))}
    </>
  );
}

function AppShowcasePanel({ app, index }: { app: (typeof SHOWCASE_APPS)[0]; index: number }) {
  const { ref, visible } = useReveal(0.1);
  const even = index % 2 === 1;
  return (
    <section
      ref={ref}
      data-snap-section
      className={`min-h-[100dvh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-20 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className={`mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20 items-center ${even ? "lg:direction-rtl" : ""}`}>
        <div className={even ? "lg:order-2" : ""}>
          <h2 className="text-heading-section mb-5">{app.title}</h2>
          <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-[440px]">{app.description}</p>
          <StaticPromptBar promptText={app.prompt.replace(/^["']|["']$/g, "")} />
        </div>
        <div className={`flex justify-center ${even ? "lg:order-1" : ""}`}>
          <PhoneMockup app={app} />
        </div>
      </div>
    </section>
  );
}

function PhoneMockup({ app }: { app: (typeof SHOWCASE_APPS)[0] }) {
  const videoSrc = app.videoSrc;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          video.currentTime = 0;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 } // panel must be ≥50% visible to trigger play
    );

    obs.observe(video);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="waitlist-phone-frame relative w-[280px] sm:w-[300px]" style={{ border: "none", outline: "none", boxShadow: "none" }}>
      <div className="aspect-[9/19.5] w-full overflow-hidden bg-[#0A0A0B] relative" style={{ border: "none", outline: "none", boxShadow: "none", borderRadius: 0 }}>
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            style={{ border: "none", outline: "none", boxShadow: "none", display: "block", background: "#0A0A0B" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--background-primary)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--border-default)]/80">
              <svg className="h-6 w-6 text-[var(--text-tertiary)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── How it works (3 steps) ───────────────────────────────────────────────────
function WaitlistHowItWorks() {
  const { ref, visible } = useReveal(0.1);
  const steps = [
    { num: "01", Icon: MessageCircle, title: "Describe your app", desc: "Write a plain-text prompt describing what you want. Features, design, behavior — just tell VibeTree what to build." },
    { num: "02", Icon: Zap, title: "We build it natively", desc: "Real SwiftUI code — not a wrapper or a web view. Compiled in the cloud, preview it instantly in your browser." },
    { num: "03", Icon: Smartphone, title: "Install on your phone", desc: "Install directly to your iPhone via USB, or submit to the App Store. You own every line of code." },
  ];
  return (
    <section
      id="how-it-works"
      ref={ref}
      className={`px-4 py-24 sm:px-6 sm:py-32 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
    >
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--link-default)] mb-4">How it works</p>
        <h2 className="text-heading-section text-center mb-16">Prompt to phone in minutes</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.num} className="waitlist-step-card p-8 sm:p-9 border-[var(--border-default)] hover:border-[var(--link-default)]/30 transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="text-4xl font-bold text-[var(--link-default)]/20 mb-5">{s.num}</div>
              <div className="mb-4 flex items-center justify-start">
                <s.Icon className="h-8 w-8 text-[var(--link-default)]" aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Why VibeTree differentiators ─────────────────────────────────────────────
function WaitlistWhy() {
  const { ref, visible } = useReveal(0.1);
  const cards = [
    { Icon: Wrench, title: "Pure SwiftUI output", desc: "Every app compiles natively with Xcode. No React Native, no Expo, no web views. Performance and quality your users can feel.", tag: "Core differentiator" },
    { Icon: Eye, title: "Readable & editable", desc: "Clean, commented code that follows Apple's conventions. Modify in Xcode or iterate with more prompts — it's your code." },
    { Icon: Cloud, title: "Cloud builds", desc: "No Mac required. We compile in the cloud so you can build iOS apps from any device, anywhere." },
    { Icon: Store, title: "App Store ready", desc: "Proper architecture, asset catalogs, and entitlements out of the box. One-tap App Store submission coming at launch." },
  ];
  return (
    <section
      id="features"
      ref={ref}
      className={`px-4 py-20 sm:px-6 sm:py-28 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
    >
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--link-default)] mb-4">Why VibeTree</p>
        <h2 className="text-heading-section text-center mb-12">Real native apps, not web views in a wrapper</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {cards.map((c) => (
            <Card key={c.title} className="waitlist-feature-card p-8 border-[var(--border-default)] hover:border-[var(--link-default)]/25 hover:bg-[var(--background-tertiary)] transition-all">
              <div className="mb-3 flex items-center justify-start">
                <c.Icon className="h-7 w-7 text-[var(--link-default)]" aria-hidden />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{c.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{c.desc}</p>
              {c.tag && (
                <span className="inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--link-default)]/10 text-[var(--link-default)] border border-[var(--border-default)]">
                  {c.tag}
                </span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Bottom CTA (repeat waitlist form) ───────────────────────────────────────
function WaitlistBottomCta({
  glassMode,
  email,
  name,
  error,
  loading,
  onEmailChange,
  onNameChange,
  onSubmit,
  setError,
}: {
  glassMode: boolean;
  email: string;
  name: string;
  error: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  setError: (v: string) => void;
}) {
  const formContent = (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5 justify-center items-center max-w-xl mx-auto">
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => { onEmailChange(e.target.value); setError(""); }}
        className="w-full sm:max-w-[320px]"
        autoComplete="email"
      />
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Joining…" : "Join the waitlist →"}
      </Button>
    </form>
  );
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32 text-center relative">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" />
      <div className="relative">
        <h2 className="text-heading-section mb-4">Build your first app in minutes</h2>
        <p className="text-[var(--text-secondary)] text-base mb-9">Join the waitlist. Top referrers get early access + free Pro.</p>
        {glassMode ? (
          <div className="waitlist-form-card mx-auto max-w-xl rounded-2xl p-6">
            {formContent}
          </div>
        ) : (
          formContent
        )}
        <p className="text-xs text-[var(--text-tertiary)] mt-2">Optional: add your name after joining to move up the list.</p>
        {error && <p className="mt-2 text-sm text-[var(--semantic-error)]">{error}</p>}
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
  const [glassMode, setGlassMode] = useState(false);

  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [hasReturnedToTab, setHasReturnedToTab] = useState(false);
  const wasHiddenRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  // Start at top when page loads or when switching to post-signup view (avoids scroll restoration putting you mid-page)
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [joined]);

  // Disable browser scroll restoration so we always start at top when visiting /waitlist
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  // Show "I did it" only after user has left the tab and come back (e.g. opened Share link)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
      } else if (document.visibilityState === "visible" && wasHiddenRef.current) {
        setHasReturnedToTab(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Hydrate from server on load if token exists; restore button style
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
        const ab = (getCookie("ab_variant") ?? "a") as "a" | "b";
        // Show success immediately from join response so user sees confirmation
        setStatus({
          token: data.token,
          email: trimmedEmail,
          name: name.trim(),
          referralCode: data.referralCode ?? "",
          position: data.position ?? 0,
          signupPosition: data.position ?? 0,
          points: data.points ?? 100,
          completedActions: ["signup"],
          abVariant: ab,
          referralCount: 0,
        });
        setJoined(true);
        // Refresh rank and leaderboard in background
        const token = data.token;
        fetchStatus(token).then(() => fetchLeaderboard(token));
      }
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
    const affiliateLink = getReferralLink();
    const text = affiliateLink
      ? `${TWEET_TEXT} Join here: ${affiliateLink}`
      : TWEET_TEXT;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
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

  const countdown = useLaunchCountdown();

  return (
    <div className={`flex h-screen flex-col bg-[var(--background-primary)] ${jetbrainsMono.variable} ${glassMode ? "waitlist-theme-glass" : ""}`}>
      <WaitlistMinimalNav glassMode={glassMode} />
      <main ref={mainRef} className="waitlist-scroll-container flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Pre-signup: hero + form + scroll hint, then showcase, how it works, why, bottom CTA */}
        {!joined ? (
          <>
            {/* Hero: countdown, headline, subheading, form, scroll hint */}
            <section data-snap-section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pt-8 pb-6 sm:px-6 sm:pt-10">
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 80% 50% at 50% -20%, var(--link-default), transparent)",
                }}
              />
              <div className="relative mx-auto max-w-2xl text-center">
                {/* Countdown pill */}
                <div className="waitlist-countdown-badge mb-5 inline-flex items-center gap-4 rounded-full border border-[var(--border-default)] bg-[var(--link-default)]/10 px-6 py-2.5">
                  {countdown.live ? (
                    <span className="text-sm font-semibold text-[var(--link-default)]">We&apos;re live!</span>
                  ) : (
                    <>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--link-default)] whitespace-nowrap">
                        Launching in
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col items-center min-w-[2.5rem]">
                          <span className={`text-lg font-medium tabular-nums text-[var(--text-primary)] ${jetbrainsMono.className}`}>
                            {String(countdown.days).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">days</span>
                        </div>
                        <span className={`text-base text-[var(--text-tertiary)] self-start ${jetbrainsMono.className}`}>:</span>
                        <div className="flex flex-col items-center min-w-[2.5rem]">
                          <span className={`text-lg font-medium tabular-nums text-[var(--text-primary)] ${jetbrainsMono.className}`}>
                            {String(countdown.hours).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">hrs</span>
                        </div>
                        <span className={`text-base text-[var(--text-tertiary)] self-start ${jetbrainsMono.className}`}>:</span>
                        <div className="flex flex-col items-center min-w-[2.5rem]">
                          <span className={`text-lg font-medium tabular-nums text-[var(--text-primary)] ${jetbrainsMono.className}`}>
                            {String(countdown.mins).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">min</span>
                        </div>
                        <span className={`text-base text-[var(--text-tertiary)] self-start ${jetbrainsMono.className}`}>:</span>
                        <div className="flex flex-col items-center min-w-[2.5rem]">
                          <span className={`text-lg font-medium tabular-nums text-[var(--text-primary)] ${jetbrainsMono.className}`}>
                            {String(countdown.secs).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">sec</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <h1 className="text-heading-hero mb-3.5 animate-fade-in leading-tight">
                  Describe an app.
                  <br />
                  <span className="text-[var(--link-default)]">Run it on your phone.</span>
                </h1>
                <p className="text-body-muted text-lg max-w-[520px] mx-auto animate-fade-in mb-6">
                  Turn a text prompt into a real, native iOS app — running on your phone in minutes.
                </p>
                {/* Join form */}
                <div id="join" className="scroll-mt-24">
                  <Card className="waitlist-form-card animate-fade-in mx-auto max-w-xl p-4 sm:p-5 text-left">
                    <form onSubmit={handleJoin} className="space-y-3">
                      <Input
                        id="waitlist-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full"
                        autoComplete="email"
                        aria-label="Email"
                      />
                      <Input
                        id="waitlist-name"
                        type="text"
                        placeholder="Your name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full"
                        autoComplete="name"
                        aria-label="Name (optional)"
                      />
                      {error && <p className="text-sm text-[var(--semantic-error)]">{error}</p>}
                      <Button type="submit" variant="primary" disabled={loading} className="w-full">
                        {loading ? "Joining…" : "Join the waitlist →"}
                      </Button>
                    </form>
                  </Card>
                </div>
                {/* Scroll hint */}
                <div className="mt-6 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
                    See what you can build
                  </span>
                  <ChevronDown
                    className="h-5 w-5 text-[var(--text-tertiary)] animate-arrow-nudge"
                    aria-hidden
                  />
                </div>
              </div>
            </section>

            <WaitlistShowcase />
            <WaitlistHowItWorks />
            <WaitlistWhy />
            <WaitlistBottomCta glassMode={glassMode} email={email} name={name} error={error} loading={loading} onEmailChange={setEmail} onNameChange={setName} onSubmit={handleJoin} setError={setError} />
          </>
        ) : (
          /* Post-signup: existing flow — one viewport with card + actions below */
          <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
            <section className="landing-section relative flex flex-shrink-0 flex-col justify-center overflow-hidden px-4 pt-[calc(4rem-3vh)] pb-4 sm:px-6 sm:pt-[calc(5rem-3vh)] sm:pb-6">
              <div className="relative mx-auto max-w-2xl text-center">
                <h1 className="text-heading-hero mb-4 animate-fade-in">Get earlier access</h1>
                <p className="text-body-muted animate-fade-in text-lg">
                  Join the waitlist and move up by sharing, inviting friends, and following along. The more you do, the sooner you get in.
                </p>
              </div>
            </section>
            <section id="join" className="landing-section -mt-[3vh] flex flex-1 flex-col justify-center px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6">
              <div className="mx-auto w-full max-w-xl">
            {status ? (
              <Card className="animate-fade-in py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--link-default)]/15">
                  <Check className="h-7 w-7 text-[var(--link-default)]" aria-hidden />
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
                  Share, follow, and invite friends to earn points and move up.
                </p>
                <a
                  href="#move-up"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-[var(--link-default)]/50 bg-[var(--link-default)]/10 py-3 text-sm font-semibold text-[var(--link-default)] transition-colors hover:border-[var(--link-default)] hover:bg-[var(--link-default)]/20"
                >
                  See actions to earn points
                  <ChevronDown className="h-4 w-4 shrink-0 animate-arrow-nudge" aria-hidden />
                </a>
              </Card>
            ) : (
              <Card className="animate-fade-in p-6 sm:p-8">
                <h2 className="mb-6 text-center text-heading-card">
                  Join the waitlist
                </h2>
                <p className="mb-6 text-center text-sm text-body-muted">
                  Enter your email to reserve your spot. Complete actions below to move up.
                </p>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="waitlist-email"
                      className="mb-1.5 block pl-3 text-sm font-medium text-body-muted"
                    >
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
                    <label
                      htmlFor="waitlist-name"
                      className="mb-1.5 block pl-3 text-sm font-medium text-body-muted"
                    >
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
                  <div className="flex justify-center pt-4 pb-2">
                    <Button type="submit" variant="primary" disabled={loading} className="w-full sm:w-auto">
                      {loading ? "Joining…" : "Join the waitlist"}
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        </section>
        </div>
        )}

        {/* Variant B: leaderboard above actions (outside page 1 so page 1 stays one screen) */}
        {abVariant === "b" && top10.length > 0 && (
          <Leaderboard top10={top10} userRank={userRank} />
        )}

        {/* Page 2: actions */}
        <section id="move-up" className="landing-section border-t border-[var(--border-default)] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
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
              Complete an action, then hit &quot;I did it&quot; to earn points and move up.
            </p>
            <div className="space-y-4">
              {abVariant === "b" ? (
                // Variant B order: invite first
                <>
                  <InviteCard referralLink={getReferralLink()} copied={copied} onCopy={copyReferral} referralCount={status?.referralCount ?? 0} />
                  <TaskCard id="share" title="Share on Twitter / X" description="Share that you joined the waitlist" points={ACTION_POINTS.share} done={isDone("share")} actionHref={getTweetUrl()} actionLabel="Share" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="follow_x" title="Follow us on Twitter / X" description="Follow @vibetree" points={ACTION_POINTS.follow_x} done={isDone("follow_x")} actionHref={FOLLOW_URL} actionLabel="Follow" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="follow_threads" title="Follow us on Threads" description="Follow @vibetree on Threads" points={ACTION_POINTS.follow_threads} done={isDone("follow_threads")} actionHref={THREADS_URL} actionLabel="Follow" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="discord" title="Join our Discord" description="Chat with the community" points={ACTION_POINTS.discord} done={isDone("discord")} actionHref={DISCORD_URL} actionLabel="Join" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="newsletter" title="Subscribe to the newsletter" description="Get updates and early access news" points={ACTION_POINTS.newsletter} done={isDone("newsletter")} actionHref={NEWSLETTER_URL} actionLabel="Subscribe" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="like" title="Like our launch post" description="Like our post on Twitter / X" points={ACTION_POINTS.like} done={isDone("like")} actionHref={POST_URL} actionLabel="Open" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                </>
              ) : (
                // Variant A order: share first
                <>
                  <TaskCard id="share" title="Share on Twitter / X" description="Share that you joined the waitlist" points={ACTION_POINTS.share} done={isDone("share")} actionHref={getTweetUrl()} actionLabel="Share" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <InviteCard referralLink={getReferralLink()} copied={copied} onCopy={copyReferral} referralCount={status?.referralCount ?? 0} />
                  <TaskCard id="follow_x" title="Follow us on Twitter / X" description="Follow @vibetree" points={ACTION_POINTS.follow_x} done={isDone("follow_x")} actionHref={FOLLOW_URL} actionLabel="Follow" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="follow_threads" title="Follow us on Threads" description="Follow @vibetree on Threads" points={ACTION_POINTS.follow_threads} done={isDone("follow_threads")} actionHref={THREADS_URL} actionLabel="Follow" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="discord" title="Join our Discord" description="Chat with the community" points={ACTION_POINTS.discord} done={isDone("discord")} actionHref={DISCORD_URL} actionLabel="Join" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="newsletter" title="Subscribe to the newsletter" description="Get updates and early access news" points={ACTION_POINTS.newsletter} done={isDone("newsletter")} actionHref={NEWSLETTER_URL} actionLabel="Subscribe" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                  <TaskCard id="like" title="Like our launch post" description="Like our post on Twitter / X" points={ACTION_POINTS.like} done={isDone("like")} actionHref={POST_URL} actionLabel="Open" onVerify={handleAction} showIdidIt={hasReturnedToTab} />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Prizes */}
        <Prizes userPosition={userRank?.rank ?? null} />

        {/* Variant A: leaderboard below tasks */}
        {abVariant !== "b" && <Leaderboard top10={top10} userRank={userRank} />}

        <Footer />
      </main>
    </div>
  );
}

// ── Prize tiers ──────────────────────────────────────────────────────────────
const PRIZE_TIERS = [
  {
    tier: "#1",
    icon: Crown,
    color: "text-yellow-400",
    bgGlow: "from-yellow-500/20 to-transparent",
    borderColor: "border-yellow-500/40",
    title: "1 Year Pro Free",
    subtitle: "or Lifetime 50% off Pro",
    description: "Full unlimited access to every feature for a year — build as many apps as you want.",
  },
  {
    tier: "#2–3",
    icon: Medal,
    color: "text-orange-400",
    bgGlow: "from-orange-500/15 to-transparent",
    borderColor: "border-orange-500/30",
    title: "6 Months Pro Free",
    subtitle: "plus a 1:1 onboarding call",
    description: "Half a year of Pro plus a personal walkthrough to get the most out of Vibetree.",
  },
  {
    tier: "#4–10",
    icon: Star,
    color: "text-sky-400",
    bgGlow: "from-sky-500/10 to-transparent",
    borderColor: "border-sky-500/25",
    title: "3 Months Pro Free",
    subtitle: "plus name a starter template",
    description: "Three months of unlimited builds, and your name on a template everyone can use.",
  },
  {
    tier: "#11–25",
    icon: Gift,
    color: "text-purple-400",
    bgGlow: "from-purple-500/10 to-transparent",
    borderColor: "border-purple-500/25",
    title: "1 Month Pro Free",
    subtitle: "plus early access (2 weeks before launch)",
    description: "Get in before everyone else and start building with a full month of Pro.",
  },
  {
    tier: "#26–50",
    icon: Zap,
    color: "text-emerald-400",
    bgGlow: "from-emerald-500/10 to-transparent",
    borderColor: "border-emerald-500/20",
    title: "Early Access + Founding Badge",
    subtitle: "2 weeks early + exclusive badge",
    description: "Access Vibetree before the public launch and earn a permanent \"Founding Builder\" badge.",
  },
];

function Prizes({ userPosition }: { userPosition: number | null }) {
  return (
    <section className="landing-section border-t border-[var(--border-default)] px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h2 className="text-heading-section">Prizes</h2>
        </div>
        <p className="text-body-muted mb-8 text-sm">
          Top point-earners win real rewards. The higher you climb, the better the prize.
        </p>
        <div className="space-y-3">
          {PRIZE_TIERS.map((prize) => {
            const Icon = prize.icon;
            const tierNums = prize.tier.replace("#", "").split("–").map(Number);
            const low = tierNums[0]!;
            const high = tierNums[1] ?? low;
            const isUserTier = userPosition !== null && userPosition >= low && userPosition <= high;

            return (
              <Card
                key={prize.tier}
                className={`relative overflow-hidden p-4 sm:p-5 transition-all ${
                  isUserTier ? `ring-2 ring-[var(--link-default)]/60` : ""
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${prize.bgGlow} pointer-events-none`}
                />
                <div className="relative flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${prize.borderColor} bg-[var(--background-tertiary)]`}>
                    <Icon className={`h-5 w-5 ${prize.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${prize.color}`}>
                        {prize.tier}
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{prize.title}</h3>
                      {isUserTier && (
                        <span className="rounded-full bg-[var(--link-default)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--link-default)]">
                          You&apos;re here
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[var(--link-default)]">{prize.subtitle}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">{prize.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <p className="text-caption mt-6 text-center text-[var(--text-tertiary)]">
          Winners determined by leaderboard position at launch. Keep earning points to move up!
        </p>
      </div>
    </section>
  );
}

// ── Inline invite card (auto-credited when referrals sign up) ────────────────
function InviteCard({
  referralLink,
  copied,
  onCopy,
  referralCount,
}: {
  referralLink: string;
  copied: boolean;
  onCopy: () => void;
  referralCount: number;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Invite friends</h3>
            <span className="rounded-full bg-[var(--link-default)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--link-default)]">
              +{ACTION_POINTS.invite} pts / referral
            </span>
          </div>
          <p className="text-caption mt-0.5 text-[var(--text-secondary)]">
            Share your link — you earn {ACTION_POINTS.invite} points automatically when someone signs up
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="gap-1 px-3 py-1.5 text-xs min-h-0"
            onClick={onCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
      {referralLink && (
        <p className="text-caption mt-3 truncate rounded bg-[var(--background-tertiary)] px-2 py-1.5 font-mono text-xs text-[var(--text-tertiary)]">
          {referralLink}
        </p>
      )}
      {referralCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--link-default)]/10 px-3 py-2">
          <Users className="h-4 w-4 text-[var(--link-default)]" />
          <span className="text-xs font-medium text-[var(--link-default)]">
            {referralCount} friend{referralCount !== 1 ? "s" : ""} signed up — {(referralCount * ACTION_POINTS.invite).toLocaleString()} pts earned!
          </span>
        </div>
      )}
    </Card>
  );
}
