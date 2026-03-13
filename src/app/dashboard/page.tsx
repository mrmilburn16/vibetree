"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, ArrowRight, Copy, Trash2, Zap, Plus } from "lucide-react";
import { Button, BetaBadge, Textarea, DropdownSelect } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { AnthropicLogo, OpenAILogo } from "@/components/icons/LLMLogos";
import { getProjects, saveProjects, deleteProject, type Project } from "@/lib/projects";
import { getFirebaseAuthAsync } from "@/lib/firebaseClient";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import { LLM_OPTIONS, DEFAULT_LLM } from "@/lib/llm-options";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";

const PENDING_PROMPT_KEY = "vibetree-pending-prompt";
const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";
const LLM_STORAGE_KEY = "vibetree-llm";
const CONFIRM_DELETE_TEXT = "DELETE";

const PROJECT_TYPE_OPTIONS = [
  { value: "standard", label: "Standard (Expo)" },
  { value: "pro", label: "Pro (Swift)" },
] as const;

type PreflightResult = {
  runner: { ok: boolean; runnerId?: string };
  device: { ok: boolean; name?: string; id?: string };
  teamId: { ok: boolean; value?: string };
  files: { ok: boolean; count?: number };
};

async function fetchTeamIdForPreflight(): Promise<string> {
  try {
    const res = await fetch("/api/user/development-team", { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { developmentTeamId?: string };
    return typeof data.developmentTeamId === "string" ? data.developmentTeamId.trim() : "";
  } catch {
    return "";
  }
}

const LLM_OPTIONS_WITH_ICONS = LLM_OPTIONS.map((opt) => ({
  ...opt,
  icon:
    opt.value === "auto"
      ? <Zap className="h-4 w-4" />
      : opt.value.startsWith("gpt") || opt.value.startsWith("codex")
        ? <OpenAILogo />
        : <AnthropicLogo />,
}));


function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Animated placeholder ─────────────────────────────────────────────────────
const PLACEHOLDER_PHRASES = [
  "e.g. A pizza delivery tracker with Live Activities on the Lock Screen",
  "e.g. A workout log that reads from HealthKit and shows weekly charts",
  "e.g. A plant care app with photo identification and watering reminders",
  "e.g. A meditation timer with ambient sounds and a sleep countdown",
  "e.g. A dog walker app that tracks routes with GPS on a live map",
];
const MORPH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&?";
type PlaceholderStyle = "typewriter" | "crossfade" | "slide-up" | "blur" | "morph";

function AnimatedPlaceholder({ style, visible }: { style: PlaceholderStyle; visible: boolean }) {
  const [text, setText] = useState(PLACEHOLDER_PHRASES[0]);
  const [phase, setPhase] = useState<"show" | "exit" | "enter">("show");
  const idxRef = useRef(0);
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (t1.current) { clearTimeout(t1.current); t1.current = null; }
    if (t2.current) { clearTimeout(t2.current); t2.current = null; }
    if (iv.current) { clearInterval(iv.current); iv.current = null; }
  }, []);

  useEffect(() => {
    clear();
    idxRef.current = 0;
    setText(PLACEHOLDER_PHRASES[0]);
    setPhase("show");
  }, [style, clear]);

  // Typewriter
  useEffect(() => {
    if (style !== "typewriter") return;
    const state = { phraseIdx: 0, charIdx: PLACEHOLDER_PHRASES[0].length, deleting: true };
    function tick() {
      const phrase = PLACEHOLDER_PHRASES[state.phraseIdx];
      if (state.deleting) {
        state.charIdx = Math.max(0, state.charIdx - 1);
        setText(phrase.slice(0, state.charIdx));
        if (state.charIdx === 0) {
          state.deleting = false;
          state.phraseIdx = (state.phraseIdx + 1) % PLACEHOLDER_PHRASES.length;
          t1.current = setTimeout(tick, 347);
        } else {
          t1.current = setTimeout(tick, 29);
        }
      } else {
        const p = PLACEHOLDER_PHRASES[state.phraseIdx];
        state.charIdx = Math.min(p.length, state.charIdx + 1);
        setText(p.slice(0, state.charIdx));
        if (state.charIdx === p.length) {
          state.deleting = true;
          t1.current = setTimeout(tick, 2310);
        } else {
          t1.current = setTimeout(tick, 52);
        }
      }
    }
    t1.current = setTimeout(tick, 2310);
    return clear;
  }, [style, clear]);

  // Crossfade
  useEffect(() => {
    if (style !== "crossfade") return;
    function cycle() {
      setPhase("exit");
      t1.current = setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % PLACEHOLDER_PHRASES.length;
        setText(PLACEHOLDER_PHRASES[idxRef.current]);
        setPhase("enter");
        t2.current = setTimeout(() => { setPhase("show"); t1.current = setTimeout(cycle, 4000); }, 50);
      }, 500);
    }
    t1.current = setTimeout(cycle, 4000);
    return clear;
  }, [style, clear]);

  // Slide up
  useEffect(() => {
    if (style !== "slide-up") return;
    function cycle() {
      setPhase("exit");
      t1.current = setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % PLACEHOLDER_PHRASES.length;
        setText(PLACEHOLDER_PHRASES[idxRef.current]);
        setPhase("enter");
        t2.current = setTimeout(() => { setPhase("show"); t1.current = setTimeout(cycle, 4000); }, 50);
      }, 450);
    }
    t1.current = setTimeout(cycle, 4000);
    return clear;
  }, [style, clear]);

  // Blur swap
  useEffect(() => {
    if (style !== "blur") return;
    function cycle() {
      setPhase("exit");
      t1.current = setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % PLACEHOLDER_PHRASES.length;
        setText(PLACEHOLDER_PHRASES[idxRef.current]);
        setPhase("enter");
        t2.current = setTimeout(() => { setPhase("show"); t1.current = setTimeout(cycle, 4000); }, 50);
      }, 450);
    }
    t1.current = setTimeout(cycle, 4000);
    return clear;
  }, [style, clear]);

  // Morph / scramble
  useEffect(() => {
    if (style !== "morph") return;
    let currentText = PLACEHOLDER_PHRASES[0];
    function cycle() {
      const to = PLACEHOLDER_PHRASES[(idxRef.current + 1) % PLACEHOLDER_PHRASES.length];
      idxRef.current = (idxRef.current + 1) % PLACEHOLDER_PHRASES.length;
      const STEPS = 14;
      let step = 0;
      iv.current = setInterval(() => {
        step++;
        if (step >= STEPS) {
          currentText = to;
          setText(to);
          if (iv.current) { clearInterval(iv.current); iv.current = null; }
          t1.current = setTimeout(cycle, 4000);
          return;
        }
        const progress = step / STEPS;
        setText(
          Array.from({ length: Math.max(currentText.length, to.length) }, (_, i) => {
            const c = to[i];
            if (!c) return "";
            if (c === " ") return " ";
            return Math.random() < progress ? c : MORPH_CHARS[Math.floor(Math.random() * MORPH_CHARS.length)];
          }).join("")
        );
      }, 35);
    }
    t1.current = setTimeout(cycle, 4000);
    return clear;
  }, [style, clear]);

  const dynStyle = () => {
    if (!visible) return { opacity: 0, transition: "opacity 0.15s ease" } as const;
    switch (style) {
      case "typewriter": return { opacity: 1 };
      case "crossfade":
        if (phase === "exit") return { opacity: 0, transition: "opacity 0.5s ease" };
        if (phase === "enter") return { opacity: 0, transition: "none" };
        return { opacity: 1, transition: "opacity 0.5s ease" };
      case "slide-up":
        if (phase === "exit") return { opacity: 0, transform: "translateY(-12px)", transition: "opacity 0.4s ease, transform 0.4s ease" };
        if (phase === "enter") return { opacity: 0, transform: "translateY(12px)", transition: "none" };
        return { opacity: 1, transform: "translateY(0)", transition: "opacity 0.4s ease, transform 0.4s ease" };
      case "blur":
        if (phase === "exit") return { opacity: 0, filter: "blur(6px)", transition: "opacity 0.4s ease, filter 0.4s ease" };
        if (phase === "enter") return { opacity: 0, filter: "blur(6px)", transition: "none" };
        return { opacity: 1, filter: "blur(0)", transition: "opacity 0.4s ease, filter 0.4s ease" };
      case "morph": return { opacity: 1 };
    }
  };

  return (
    <>
      <style>{`@keyframes tw-cursor-blink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap pr-2 text-base text-[var(--input-placeholder)]"
        style={dynStyle()}
      >
        {text}
        {style === "typewriter" && visible && (
          <span
            className="ml-px inline-block w-[1.5px]"
            style={{
              height: "1em",
              verticalAlign: "text-bottom",
              backgroundColor: "var(--input-placeholder)",
              animation: "tw-cursor-blink 0.85s step-end infinite",
            }}
          />
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  console.log("[dashboard:trace] 1) Component render/mount");
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [projectType, setProjectType] = useState<"standard" | "pro">("pro");
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const [preflightChecks, setPreflightChecks] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsFetchError, setProjectsFetchError] = useState<"session_expired" | "network" | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("[dashboard:trace] 2) Mount effect running, window=", typeof window);
    if (typeof window === "undefined") return;
    setProjects(getProjects());
    console.log("[dashboard:trace] 4) Calling setMounted(true)");
    setMounted(true);
  }, []);

  const fetchProjectsFromApi = useCallback(async () => {
    if (typeof window === "undefined") return;
    setProjectsLoading(true);
    setProjectsFetchError(null);
    let user: { uid?: string } | null = null;
    try {
      console.log("[dashboard:trace] 3a) Fetching GET /api/auth/session…");
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const sessionData = await sessionRes.json().catch(() => ({}));
      console.log("[dashboard:trace] 3b) GET /api/auth/session response:", sessionRes.status, sessionRes.ok, "body:", sessionData);
      user = sessionData?.user ?? null;
      if (!user && sessionRes.ok) {
        // Cookie present (middleware let us through) but session empty — token invalid or expired; clear and redirect to avoid loop
        console.log("[dashboard] session empty, clearing cookie and redirecting to sign-in");
        await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
        window.location.href = "/sign-in";
        return;
      }
    } catch {
      // ignore
    }
    console.log("[dashboard] fetching projects for user:", user?.uid);
    try {
      console.log("[dashboard:trace] 3c) Fetching GET /api/projects…");
      const res = await fetch("/api/projects", { credentials: "include" });
      console.log("[dashboard:trace] 3d) GET /api/projects response:", res.status, res.ok);
      if (res.status === 401) {
        setProjectsFetchError("session_expired");
        setProjects([]);
        console.log("[dashboard] projects: 401, session expired — clearing cookie and redirecting to sign-in");
        await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
        window.location.href = "/sign-in";
        return;
      }
      if (!res.ok) throw res;
      const data: { projects?: Array<Project & { projectType?: string }> } = await res.json();
      setProjectsFetchError(null);
      const list = Array.isArray(data.projects) ? data.projects : [];
      const normalized: Project[] = list.map((p) => ({
        id: p.id,
        name: p.name,
        bundleId: p.bundleId ?? "",
        createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
      }));
      setProjects(normalized);
      saveProjects(normalized);
      console.log("[dashboard] projects loaded from API:", normalized.length, "projects");
    } catch (err) {
      setProjectsFetchError("network");
      setProjects(getProjects());
      console.warn("[dashboard] projects fetch failed:", err);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchProjectsFromApi();
  }, [mounted, fetchProjectsFromApi]);

  useRefetchOnVisible(fetchProjectsFromApi, mounted);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const storedType = localStorage.getItem(PROJECT_TYPE_STORAGE_KEY);
    const storedLlm = localStorage.getItem(LLM_STORAGE_KEY);
    if (storedType === "pro" || storedType === "standard") setProjectType(storedType);
    else localStorage.setItem(PROJECT_TYPE_STORAGE_KEY, "pro");
    const llmOption = LLM_OPTIONS.find((o) => o.value === storedLlm && !o.disabled);
    if (llmOption) setLlm(storedLlm!);
    else localStorage.setItem(LLM_STORAGE_KEY, DEFAULT_LLM);
  }, [mounted]);

  const handleProjectTypeChange = (value: string) => {
    const next = value === "pro" ? "pro" : "standard";
    setProjectType(next);
    if (typeof window !== "undefined") localStorage.setItem(PROJECT_TYPE_STORAGE_KEY, next);
  };

  const handleLlmChange = (value: string) => {
    setLlm(value);
    if (typeof window !== "undefined") localStorage.setItem(LLM_STORAGE_KEY, value);
  };

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const teamId = await fetchTeamIdForPreflight();
      const q = new URLSearchParams();
      if (teamId) q.set("teamId", teamId);
      const res = await fetch(`/api/macos/preflight?${q.toString()}`);
      if (res.ok) {
        const data: PreflightResult = await res.json();
        setPreflightChecks(data);
      }
    } catch {
      setPreflightChecks(null);
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted || projectType !== "pro") return;
    runPreflight();
  }, [mounted, projectType, runPreflight]);

  const proPreflightReady =
    preflightChecks != null &&
    preflightChecks.runner.ok &&
    preflightChecks.device.ok &&
    preflightChecks.teamId.ok;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, [prompt]);

  const doSubmitPrompt = useCallback(
    async (trimmed: string) => {
      localStorage.setItem(PENDING_PROMPT_KEY, trimmed);
      setCreateError(null);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Untitled app", projectType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : "Project could not be created.";
          setCreateError(msg);
          console.warn("[dashboard] POST /api/projects failed", { status: res.status, code: data?.code, error: msg });
          return;
        }
        const project = (data as { project: Project }).project;
        const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
        setProjects(next);
        saveProjects(next);
        router.push(`/editor/${project.id}`);
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Project could not be created.");
        console.warn("[dashboard] POST /api/projects failed (network or other)", e);
      }
    },
    [router, projectType, projects]
  );

  const blockStartUntilPreflight = projectType === "pro" && !proPreflightReady;

  const handleSubmitPrompt = useCallback(
    (text?: string) => {
      const trimmed = (text ?? prompt).trim();
      if (!trimmed) return;
      if (blockStartUntilPreflight) return;
      doSubmitPrompt(trimmed);
    },
    [prompt, blockStartUntilPreflight, doSubmitPrompt]
  );

  async function handleNewApp() {
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled app", projectType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Project could not be created.";
        setCreateError(msg);
        console.warn("[dashboard] handleNewApp: POST /api/projects failed", { status: res.status, code: data?.code, error: msg });
        return;
      }
      const project = (data as { project: Project }).project;
      const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
      setProjects(next);
      saveProjects(next);
      router.push(`/editor/${project.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Project could not be created.");
      console.warn("[dashboard] handleNewApp: POST /api/projects failed (network or other)", e);
    }
  }

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTargetId(id);
    setDeleteConfirmInput("");
  }

  function closeDeleteModal() {
    setDeleteTargetId(null);
    setDeleteConfirmInput("");
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId || deleteConfirmInput !== CONFIRM_DELETE_TEXT) return;
    try {
      const res = await fetch(`/api/projects/${deleteTargetId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      const next = projects.filter((p) => p.id !== deleteTargetId);
      setProjects(next);
      saveProjects(next);
      closeDeleteModal();
    } catch {
      deleteProject(deleteTargetId);
      setProjects(getProjects());
      closeDeleteModal();
    }
  }

  async function handleDuplicate(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const name = `${source.name} (copy)`;
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Project could not be created.";
        setCreateError(msg);
        console.warn("[dashboard] handleDuplicate: POST /api/projects failed", { status: res.status, code: data?.code, error: msg });
        return;
      }
      const project = (data as { project: Project }).project;
      const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
      setProjects(next);
      saveProjects(next);
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Project could not be created.");
      console.warn("[dashboard] handleDuplicate: POST /api/projects failed (network or other)", err);
    }
  }

  if (!mounted) {
    console.log("[dashboard:trace] 5) Rendering loading spinner (mounted=false)");
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--button-primary-bg)] border-t-transparent" />
      </div>
    );
  }

  console.log("[dashboard:trace] 6) Rendering main dashboard (mounted=true)");
  return (
    <div className="relative min-h-screen bg-[var(--background-primary)]">
      {/* Gradient glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(var(--accent-rgb), 0.5), transparent 60%)",
        }}
      />

      {/* Minimal header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)]/50 bg-[var(--background-primary)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="text-lg font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
            >
              Vibetree
            </Link>
            <BetaBadge />
          </div>
          <div className="flex items-center gap-3">
            <CreditsWidget />
            <Link href="/settings">
              <Button variant="ghost" size="sm">Settings</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
                  const auth = await getFirebaseAuthAsync();
                  if (auth) await auth.signOut();
                } finally {
                  window.location.href = "/";
                }
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <LowCreditBanner />

      <main className="relative mx-auto max-w-2xl px-5">
        {/* Hero prompt area */}
        <div className="flex flex-col items-center pt-16 pb-12 text-center animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            What do you want to build?
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Describe your app — AI writes the code, you ship to your iPhone.
          </p>

          {/* Prompt container — pill + dropdowns below */}
          <div className="mt-8 w-full">
            {/* Pill */}
            <div className="relative w-full rounded-[9999px] border-2 border-[var(--border-default)] bg-[var(--background-secondary)] transition-all duration-300 focus-within:border-[var(--button-primary-bg)] focus-within:ring-2 focus-within:ring-[var(--button-primary-bg)]/25">
              <div className="flex min-h-[46px] items-end gap-2 px-3 py-[6px]">
                {/* LEFT: plus — triggers file picker */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { setAttachedImage(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  aria-label={attachedImage ? `Image attached: ${attachedImage.name}` : "Attach an image"}
                  title={attachedImage ? attachedImage.name : "Attach an image"}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    attachedImage ? "text-[var(--button-primary-bg)]" : "text-[var(--text-tertiary)] hover:text-white"
                  }`}
                >
                  <Plus className="h-[18px] w-[18px]" style={{ display: "block" }} aria-hidden />
                </button>

                {/* CENTER: textarea */}
                <div className="relative flex min-w-0 flex-1 items-center">
                  {!prompt && <AnimatedPlaceholder style="typewriter" visible={!inputFocused} />}
                  <Textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder=""
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    className="!border-0 !min-h-0 max-h-[200px] w-full resize-none bg-transparent text-[var(--input-text)] !shadow-none !ring-0 focus:!border-0 focus:!ring-0 focus:outline-none"
                    style={{ resize: "none", paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, fontSize: 16, lineHeight: "22px", minHeight: 22, display: "block", overflowY: "hidden" }}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitPrompt();
                      }
                    }}
                  />
                </div>

                {/* RIGHT: circular send button — using plain <button> to avoid Button's default py-2.5 */}
                <button
                  type="button"
                  disabled={!prompt.trim() || blockStartUntilPreflight}
                  onClick={() => handleSubmitPrompt()}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] transition-all duration-[var(--transition-normal)] ease-out hover:bg-[var(--button-primary-hover)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:scale-100"
                  style={{ borderRadius: "9999px", padding: 0 }}
                  aria-label={blockStartUntilPreflight ? "Fix iPhone setup in Settings to start building" : "Start building"}
                  title={blockStartUntilPreflight ? "Fix iPhone setup in Settings before building" : undefined}
                >
                  <Send className="h-[18px] w-[18px]" style={{ display: "block", transform: "translate(-0.5px, -0.5px)" }} aria-hidden />
                </button>
              </div>
            </div>

            {/* Dropdowns below pill */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <DropdownSelect
                options={[...PROJECT_TYPE_OPTIONS]}
                value={projectType}
                onChange={handleProjectTypeChange}
                aria-label="Build mode: Standard (Expo) or Pro (Swift)"
                triggerClassName="!rounded-[9999px]"
              />
              <DropdownSelect
                options={LLM_OPTIONS_WITH_ICONS}
                value={llm}
                onChange={handleLlmChange}
                aria-label="Select AI model for app design"
                triggerClassName="!rounded-[9999px]"
              />
            </div>

            {/* Attached image indicator */}
            {attachedImage && (
              <div className="mt-1.5 flex items-center justify-center gap-1 text-xs text-[var(--text-tertiary)]">
                <span className="max-w-[200px] truncate">{attachedImage.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  aria-label="Remove image"
                  className="text-[var(--text-tertiary)] hover:text-[var(--semantic-error)]"
                >
                  ×
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Session expired — clear cookie and redirect so middleware does not loop */}
        {projectsFetchError === "session_expired" && (
          <div className="mb-4 rounded-xl border border-[var(--semantic-warning)]/50 bg-[var(--semantic-warning)]/10 px-4 py-3 text-center">
            <p className="text-sm text-[var(--text-primary)]">
              Session expired. Redirecting to sign in…
            </p>
          </div>
        )}

        {createError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-[var(--text-primary)]">{createError}</p>
            <button
              type="button"
              onClick={() => setCreateError(null)}
              className="shrink-0 text-sm font-medium text-[var(--link-default)] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Projects section */}
        {projects.length > 0 && (
          <section className="pb-16 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Recent apps
              </h2>
              <button
                type="button"
                onClick={handleNewApp}
                className="text-xs font-medium text-[var(--link-default)] hover:underline"
              >
                New blank app
              </button>
            </div>
            <div className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)]">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/editor/${project.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--background-tertiary)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--background-tertiary)] text-[var(--text-tertiary)] transition-colors group-hover:bg-[var(--button-primary-bg)]/15 group-hover:text-[var(--link-default)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="4" y="2" width="16" height="20" rx="2.5" />
                      <path d="M9 6h6" /><path d="M9 10h6" /><path d="M9 14h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{project.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Updated {timeAgo(project.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(e, project.id); }}
                      className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                      aria-label="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(e, project.id); }}
                      className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--link-default)]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state — no projects */}
        {projects.length === 0 && (
          <div className="pb-16 text-center animate-fade-in" style={{ animationDelay: "150ms" }}>
            <p className="text-sm text-[var(--text-tertiary)]">
              No apps yet. Type a prompt above to create your first one.
            </p>
          </div>
        )}

        {/* Footer links */}
        <div className="flex justify-center gap-6 border-t border-[var(--border-default)]/50 py-8">
          <Link href="/docs" className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--link-default)]">Docs</Link>
          <Link href="/pricing" className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--link-default)]">Pricing</Link>
          <Link href="/contact" className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--link-default)]">Contact</Link>
        </div>
      </main>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={closeDeleteModal}
        title="Delete app"
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteConfirmInput !== CONFIRM_DELETE_TEXT}>Delete</Button>
          </>
        }
      >
        <p className="text-[var(--text-secondary)] mb-4">
          This will permanently delete this app and its data. This cannot be undone.
        </p>
        <p className="text-sm text-[var(--text-tertiary)] mb-2">
          Type <strong className="text-[var(--text-primary)] font-mono">{CONFIRM_DELETE_TEXT}</strong> to confirm:
        </p>
        <input
          type="text"
          value={deleteConfirmInput}
          onChange={(e) => setDeleteConfirmInput(e.target.value)}
          placeholder={CONFIRM_DELETE_TEXT}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-primary)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--button-primary-bg)]"
          aria-label="Type DELETE to confirm"
          autoComplete="off"
        />
      </Modal>

    </div>
  );
}
