"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { getProjects, createProject, deleteProject, type Project } from "@/lib/projects";
import { DashboardCard, NewAppCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/dashboard/EmptyState";

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

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);

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

  function handleNewApp() {
    const project = createProject();
    setProjects(getProjects());
    router.push(`/editor/${project.id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined" && window.confirm("Delete this project?")) {
      deleteProject(id);
      setProjects(getProjects());
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
      {/* Subtle gradient background — adds depth without noise */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, var(--button-primary-bg), transparent 60%)",
        }}
      />
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="text-xl font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
          >
            Vibetree
          </Link>
          <div className="flex items-center gap-3">
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
                  <DashboardCard project={project} onDelete={handleDelete} />
                </div>
              ))}
            </div>

            {/* Quick links + tip — fills the canvas and adds utility */}
            <div className="mt-16 flex flex-col gap-8 border-t border-[var(--border-default)] pt-12 sm:flex-row sm:items-start sm:justify-between">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)]/80 px-4 py-3">
                <p className="text-caption text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">Tip:</span> Describe your app in plain language in chat—AI writes Swift and you preview live.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/docs"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                >
                  Docs
                </a>
                <a
                  href="/pricing"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                >
                  Pricing
                </a>
                <a
                  href="/contact"
                  className="rounded-full border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                >
                  Contact
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
