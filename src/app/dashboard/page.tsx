"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, BetaBadge } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getProjects, createProject, deleteProject, duplicateProject, type Project } from "@/lib/projects";
import { DashboardCard, NewAppCard } from "@/components/dashboard/DashboardCard";
import { DashboardLayout2 } from "@/components/dashboard/DashboardLayout2";
import { CreditsWidget } from "@/components/credits/CreditsWidget";
import { LowCreditBanner } from "@/components/credits/LowCreditBanner";
import { EmptyState } from "@/components/dashboard/EmptyState";

const LAYOUT_STORAGE_KEY = "vibetree-dashboard-layout";

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-2 h-9 w-32 animate-skeleton rounded bg-[var(--background-secondary)]" />
      <div className="mb-8 h-5 w-64 animate-skeleton rounded bg-[var(--background-secondary)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-[180px] flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5"
          >
            <div className="flex gap-3">
              <div className="h-12 w-12 shrink-0 animate-skeleton rounded-[var(--radius-md)] bg-[var(--background-tertiary)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-3/4 animate-skeleton rounded bg-[var(--background-tertiary)]" />
                <div className="h-4 w-1/2 animate-skeleton rounded bg-[var(--background-tertiary)]" />
              </div>
            </div>
            <div className="mt-auto h-10 w-24 animate-skeleton rounded-[var(--radius-md)] bg-[var(--background-tertiary)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const CONFIRM_DELETE_TEXT = "DELETE";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState<"1" | "2">("1");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const session = localStorage.getItem("vibetree-session");
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    setProjects(getProjects());
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored === "1" || stored === "2") setLayoutVersion(stored);
    setMounted(true);
  }, [router]);

  function setLayoutAndPersist(value: "1" | "2") {
    setLayoutVersion(value);
    if (typeof window !== "undefined") localStorage.setItem(LAYOUT_STORAGE_KEY, value);
  }

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
      <div className="min-h-screen bg-[var(--background-primary)]">
        <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="h-7 w-28 animate-skeleton rounded bg-[var(--background-secondary)]" />
            <div className="h-10 w-24 animate-skeleton rounded bg-[var(--background-secondary)]" />
          </div>
        </header>
        <DashboardSkeleton />
      </div>
    );
  }

  const welcomeLine = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="relative min-h-screen bg-[var(--background-primary)]">
      {layoutVersion === "1" && (
        <div
          className="pointer-events-none fixed inset-0 opacity-25"
          style={{
            background: "radial-gradient(ellipse 90% 60% at 50% -15%, rgba(var(--accent-rgb), 0.4), transparent 55%)",
          }}
        />
      )}
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
            >
              Vibetree
            </Link>
            <BetaBadge />
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <div
              className="flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-0.5"
              role="group"
              aria-label="Dashboard layout"
            >
              <button
                type="button"
                onClick={() => setLayoutAndPersist("1")}
                className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  layoutVersion === "1"
                    ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                1.0
              </button>
              <button
                type="button"
                onClick={() => setLayoutAndPersist("2")}
                className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  layoutVersion === "2"
                    ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                2.0
              </button>
            </div>
            <CreditsWidget />
            <Button variant="primary" onClick={handleNewApp} className="gap-2">
              <IconPlus />
              New app
            </Button>
            <Link href="/sign-in">
              <Button variant="ghost">Sign out</Button>
            </Link>
          </div>
        </div>
      </header>

      <LowCreditBanner />

      {layoutVersion === "2" ? (
        <DashboardLayout2
          projects={projects}
          onNewApp={handleNewApp}
          onDelete={handleDeleteClick}
          onDuplicate={handleDuplicate}
        />
      ) : (
      <main className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Hero strip */}
        <div className="animate-fade-in mb-8">
          <p className="text-caption mb-1 font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {welcomeLine}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            My apps
          </h1>
          <p className="text-body-muted mt-2 text-sm">
            {projects.length === 0
              ? "Create an app to start building with AI."
              : `${projects.length} app${projects.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {projects.length === 0 ? (
          <EmptyState onCreateFirst={handleNewApp} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NewAppCard onClick={handleNewApp} index={0} />
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  className="animate-stagger-in opacity-0"
                  style={{ animationDelay: `${(index + 1) * 60}ms` }}
                >
                  <DashboardCard project={project} onDelete={handleDeleteClick} onDuplicate={handleDuplicate} />
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="mt-16 flex flex-wrap gap-3 border-t border-[var(--border-default)] pt-12">
                <Link
                  href="/docs"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/40 hover:bg-[var(--button-primary-bg)]/10 hover:text-[var(--link-default)]"
                >
                  Docs
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/40 hover:bg-[var(--button-primary-bg)]/10 hover:text-[var(--link-default)]"
                >
                  Pricing
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/40 hover:bg-[var(--button-primary-bg)]/10 hover:text-[var(--link-default)]"
                >
                  Contact
                </Link>
            </div>
          </>
        )}
      </main>
      )}

      <Modal
        isOpen={deleteTargetId !== null}
        onClose={closeDeleteModal}
        title="Delete app"
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmInput !== CONFIRM_DELETE_TEXT}
            >
              Delete
            </Button>
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
