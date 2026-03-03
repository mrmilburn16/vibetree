"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles, ArrowRight, Copy, Trash2, Zap, Bell } from "lucide-react";
import { Button, BetaBadge, Textarea, DropdownSelect } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AnthropicLogo, OpenAILogo } from "@/components/icons/LLMLogos";
import { getProjects, saveProjects, deleteProject, type Project } from "@/lib/projects";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import { getRandomAppIdeaPrompt } from "@/lib/appIdeaPrompts";
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

function getTeamIdForPreflight(): string {
  if (typeof window === "undefined") return "";
  try {
    const universal = localStorage.getItem("vibetree-universal-defaults");
    if (universal) {
      const parsed = JSON.parse(universal);
      if (typeof parsed.teamId === "string") return parsed.teamId;
    }
  } catch {}
  return "";
}

const LLM_OPTIONS_WITH_ICONS = LLM_OPTIONS.map((opt) => ({
  ...opt,
  icon:
    opt.value === "auto"
      ? <Zap className="h-4 w-4" />
      : opt.value.startsWith("gpt")
        ? <OpenAILogo />
        : <AnthropicLogo />,
}));

const SUGGESTION_CHIPS = [
  "A fitness tracker with activity rings",
  "A recipe app with step-by-step cooking",
  "A habit tracker with streaks and stats",
  "A journaling app with mood tracking",
];

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

export default function DashboardPage() {
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
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [pushTestMessage, setPushTestMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendTestPush = useCallback(async () => {
    setPushTestLoading(true);
    setPushTestMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      let message = typeof data?.message === "string" ? data.message : res.ok ? "Sent." : "Request failed.";
      if (!res.ok && typeof window !== "undefined" && message.toLowerCase().includes("no devices registered")) {
        const url = data?.suggestedServerURL ?? window.location.origin;
        message += ` On your iPhone set the Companion app Server URL to ${url} (same Wi‑Fi), then open the app and allow notifications.`;
      }
      setPushTestMessage(message);
      if (res.ok) setTimeout(() => setPushTestMessage(null), 4000);
    } catch (e) {
      setPushTestMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setPushTestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setProjects(getProjects());
    setMounted(true);
  }, [router]);

  const fetchProjectsFromApi = useCallback(() => {
    if (typeof window === "undefined") return;
    setProjectsLoading(true);
    setProjectsFetchError(null);
    fetch("/api/projects")
      .then((res) => {
        if (res.status === 401) {
          setProjectsFetchError("session_expired");
          return null;
        }
        if (!res.ok) return Promise.reject(res);
        return res.json();
      })
      .then((data: { projects?: Array<Project & { projectType?: string }> } | null) => {
        if (data == null) return;
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
      })
      .catch(() => {
        setProjectsFetchError("network");
        setProjects(getProjects());
      })
      .finally(() => {
        setProjectsLoading(false);
      });
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
      const teamId = getTeamIdForPreflight();
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
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [prompt]);

  const doSubmitPrompt = useCallback(
    async (trimmed: string) => {
      localStorage.setItem(PENDING_PROMPT_KEY, trimmed);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Untitled app", projectType }),
        });
        if (!res.ok) throw new Error("Create failed");
        const data: { project: Project } = await res.json();
        const project = data.project;
        const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
        setProjects(next);
        saveProjects(next);
        router.push(`/editor/${project.id}`);
      } catch {
        const fallback = getProjects();
        setProjects(fallback);
        const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const now = Date.now();
        const project: Project = {
          id,
          name: "Untitled app",
          bundleId: `com.vibetree.${id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40) || "app"}`,
          createdAt: now,
          updatedAt: now,
        };
        saveProjects([project, ...fallback]);
        setProjects(getProjects());
        router.push(`/editor/${project.id}`);
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
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled app", projectType }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data: { project: Project } = await res.json();
      const project = data.project;
      const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
      setProjects(next);
      saveProjects(next);
      router.push(`/editor/${project.id}`);
    } catch {
      const fallback = getProjects();
      setProjects(fallback);
      const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();
      const project: Project = {
        id,
        name: "Untitled app",
        bundleId: `com.vibetree.${id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40) || "app"}`,
        createdAt: now,
        updatedAt: now,
      };
      saveProjects([project, ...fallback]);
      setProjects(getProjects());
      router.push(`/editor/${project.id}`);
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
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectType }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data: { project: Project } = await res.json();
      const project = data.project;
      const next = [{ ...project, bundleId: project.bundleId ?? "" }, ...projects];
      setProjects(next);
      saveProjects(next);
      router.push(`/editor/${project.id}`);
    } catch {
      const fallback = getProjects();
      const copyId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();
      const project: Project = {
        id: copyId,
        name,
        bundleId: `com.vibetree.${copyId.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40) || "app"}`,
        createdAt: now,
        updatedAt: now,
      };
      saveProjects([project, ...fallback]);
      setProjects(getProjects());
      router.push(`/editor/${project.id}`);
    }
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--button-primary-bg)] border-t-transparent" />
      </div>
    );
  }

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
            <ThemeSwitcher />
            <button
              type="button"
              onClick={sendTestPush}
              disabled={pushTestLoading}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] disabled:opacity-50"
              title="Send a test push notification to your iPhone"
            >
              <Bell className="h-3.5 w-3.5" />
              {pushTestLoading ? "Sending…" : "Test push"}
            </button>
            {pushTestMessage && (
              <span className={`max-w-[180px] truncate text-[10px] ${pushTestMessage.includes("sent") || pushTestMessage.startsWith("Test") ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}`} title={pushTestMessage}>
                {pushTestMessage}
              </span>
            )}
            <CreditsWidget />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign out</Button>
            </Link>
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

          {/* Mode and model selectors */}
          <div className="mt-8 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
            <DropdownSelect
              options={[...PROJECT_TYPE_OPTIONS]}
              value={projectType}
              onChange={handleProjectTypeChange}
              aria-label="Build mode: Standard (Expo) or Pro (Swift)"
              className="w-full sm:w-auto"
            />
            <DropdownSelect
              options={LLM_OPTIONS_WITH_ICONS}
              value={llm}
              onChange={handleLlmChange}
              aria-label="Select AI model for app design"
              className="w-full sm:w-auto"
            />
          </div>

          {/* Pro (Swift): Run on iPhone readiness — check before spending credits */}
          {projectType === "pro" && (
            <div className="mt-4 w-full max-w-xl rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  Run on iPhone readiness
                </span>
                <button
                  type="button"
                  onClick={runPreflight}
                  disabled={preflightLoading}
                  className="text-xs text-[var(--link-default)] hover:underline disabled:opacity-50"
                >
                  {preflightLoading ? "Checking…" : "Re-check"}
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {preflightLoading && !preflightChecks ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--button-primary-bg)]" />
                    ) : preflightChecks?.runner.ok ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </span>
                  <span className="text-[var(--text-primary)]">Mac runner</span>
                  {preflightChecks && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {preflightChecks.runner.ok ? "Connected" : "Start npm run mac-runner"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {preflightLoading && !preflightChecks ? null : preflightChecks?.device.ok ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </span>
                  <span className="text-[var(--text-primary)]">iPhone connected</span>
                  {preflightChecks && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {preflightChecks.device.ok ? (preflightChecks.device.name ?? "Detected") : "USB or same WiFi"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {preflightLoading && !preflightChecks ? null : preflightChecks?.teamId.ok ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </span>
                  <span className="text-[var(--text-primary)]">Team ID</span>
                  {preflightChecks && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {preflightChecks.teamId.ok ? preflightChecks.teamId.value : "Set in editor or .env"}
                    </span>
                  )}
                </div>
              </div>
              {preflightChecks && !proPreflightReady && (
                <p className="mt-2 text-xs text-[var(--semantic-warning)]">
                  Fix these before building so you can run on device and avoid wasting credits.
                </p>
              )}
            </div>
          )}

          {/* Prompt input */}
          <div className="mt-4 w-full max-w-xl">
            <div
              className="flex items-end rounded-2xl border-2 border-[var(--border-default)] bg-[var(--background-secondary)] py-2 pr-2 pl-4 transition-colors duration-150 focus-within:border-[var(--button-primary-bg)] focus-within:ring-2 focus-within:ring-[var(--button-primary-bg)]/25"
            >
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A fitness tracker with activity rings and weekly stats"
                autoFocus
                className="!border-0 !min-h-[42px] max-h-[120px] w-full resize-none bg-transparent pt-2 pb-2 pr-2 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] !shadow-none !ring-0 focus:!border-0 focus:!ring-0 focus:outline-none"
                style={{ resize: "none" }}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitPrompt();
                  }
                }}
              />
              <Button
                variant="primary"
                disabled={!prompt.trim() || blockStartUntilPreflight}
                onClick={() => handleSubmitPrompt()}
                className="!flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0"
                aria-label={blockStartUntilPreflight ? "Complete Run on iPhone readiness above to start" : "Start building"}
                title={blockStartUntilPreflight ? "Complete Run on iPhone readiness above to start building" : undefined}
              >
                <Send className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            {blockStartUntilPreflight && (
              <p className="mt-2 text-xs text-[var(--semantic-warning)]">
                Complete Run on iPhone readiness above to start building.
              </p>
            )}

            {/* Suggestion chips */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSubmitPrompt(chip)}
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/40 hover:bg-[var(--button-primary-bg)]/10 hover:text-[var(--link-default)]"
                >
                  {chip}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPrompt(getRandomAppIdeaPrompt())}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:border-[var(--button-primary-bg)]/40 hover:text-[var(--link-default)]"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Surprise me
              </button>
            </div>
          </div>
        </div>

        {/* Session expired — do not replace project list with localStorage */}
        {projectsFetchError === "session_expired" && (
          <div className="mb-4 rounded-xl border border-[var(--semantic-warning)]/50 bg-[var(--semantic-warning)]/10 px-4 py-3 text-center">
            <p className="text-sm text-[var(--text-primary)]">
              Session expired, please sign in.
            </p>
            <Link href="/sign-in" className="mt-2 inline-block text-sm font-medium text-[var(--link-default)] hover:underline">
              Sign in
            </Link>
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
