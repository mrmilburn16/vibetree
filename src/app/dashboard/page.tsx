"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles, ArrowRight, Copy, Trash2 } from "lucide-react";
import { Button, BetaBadge, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getProjects, createProject, deleteProject, duplicateProject, type Project } from "@/lib/projects";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import { getRandomAppIdeaPrompt } from "@/lib/appIdeaPrompts";

const PENDING_PROMPT_KEY = "vibetree-pending-prompt";
const CONFIRM_DELETE_TEXT = "DELETE";

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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const session = localStorage.getItem("vibetree-session");
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    setProjects(getProjects());
    setMounted(true);
  }, [router]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [prompt]);

  const handleSubmitPrompt = useCallback(
    (text?: string) => {
      const trimmed = (text ?? prompt).trim();
      if (!trimmed) return;
      localStorage.setItem(PENDING_PROMPT_KEY, trimmed);
      const project = createProject();
      setProjects(getProjects());
      router.push(`/editor/${project.id}`);
    },
    [prompt, router]
  );

  function handleNewApp() {
    const project = createProject();
    setProjects(getProjects());
    router.push(`/editor/${project.id}`);
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

  function handleDeleteConfirm() {
    if (deleteTargetId && deleteConfirmInput === CONFIRM_DELETE_TEXT) {
      deleteProject(deleteTargetId);
      setProjects(getProjects());
      closeDeleteModal();
    }
  }

  function handleDuplicate(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const copy = duplicateProject(id);
    if (copy) {
      setProjects(getProjects());
      router.push(`/editor/${copy.id}`);
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

          {/* Prompt input */}
          <div className="mt-8 w-full max-w-xl">
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
                disabled={!prompt.trim()}
                onClick={() => handleSubmitPrompt()}
                className="!flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0"
                aria-label="Start building"
              >
                <Send className="h-5 w-5" aria-hidden />
              </Button>
            </div>

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
