"use client";

import Link from "next/link";
import { useCredits } from "@/contexts/CreditsContext";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { Project } from "@/lib/projects";

const IconApp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="2" width="16" height="20" rx="2.5" />
    <path d="M9 6h6" />
    <path d="M9 10h6" />
    <path d="M9 14h4" />
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

function DashboardSidebar() {
  return (
    <aside
      className="hidden w-[220px] shrink-0 border-r border-[var(--border-default)] bg-[var(--background-secondary)] lg:block"
      aria-label="Dashboard navigation"
    >
      <nav className="sticky top-[73px] flex flex-col gap-1 px-3 py-4">
        <Link
          href="/dashboard"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--button-primary-bg)]/15 text-[var(--link-default)]"
        >
          My apps
        </Link>
        <Link
          href="/docs"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
        >
          Docs
        </Link>
        <Link
          href="/pricing"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
        >
          Pricing
        </Link>
        <Link
          href="/contact"
          className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
        >
          Contact
        </Link>
        <div className="mt-auto pt-4">
          <Link
            href="/sign-in"
            className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--button-ghost-text)] transition-colors hover:text-[var(--text-primary)]"
          >
            Sign out
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-4 py-3">
      <p className="text-caption text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

interface DashboardLayout2Props {
  projects: Project[];
  onNewApp: () => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDuplicate: (e: React.MouseEvent, id: string) => void;
}

export function DashboardLayout2({ projects, onNewApp, onDelete, onDuplicate }: DashboardLayout2Props) {
  const { balance } = useCredits();
  return (
    <div className="flex min-h-screen bg-[var(--background-primary)]">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Stats strip */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Apps" value={`${projects.length}`} />
            <StatCard label="Plan" value="Creator" />
            <StatCard label="Credits" value={`${balance}`} />
          </div>

          {/* Projects section */}
          <h2 className="text-heading-section mb-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Projects
          </h2>

          {projects.length === 0 ? (
            <EmptyState onCreateFirst={onNewApp} />
          ) : (
            <ul role="list" className="divide-y divide-[var(--border-default)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)]">
              {/* New app row */}
              <li role="listitem">
                <button
                  type="button"
                  onClick={onNewApp}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--background-tertiary)] focus:bg-[var(--background-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--button-primary-bg)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
                    <IconPlus />
                  </span>
                  <span className="flex-1 text-sm font-medium text-[var(--link-default)]">New app</span>
                  <span className="text-caption text-xs text-[var(--text-tertiary)]">Start from scratch</span>
                </button>
              </li>
              {projects.map((project) => (
                <li key={project.id} role="listitem">
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--background-tertiary)] focus-within:bg-[var(--background-tertiary)] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--button-primary-bg)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
                      <IconApp />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{project.name}</p>
                      <p className="text-caption text-xs text-[var(--text-tertiary)]">
                        Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/editor/${project.id}`}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-secondary)]"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => onDuplicate(e, project.id)}
                        className="rounded-[var(--radius-sm)] p-2 text-[var(--text-secondary)] opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--background-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)]"
                        aria-label="Duplicate project"
                      >
                        <IconCopy />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDelete(e, project.id)}
                        className="rounded-[var(--radius-sm)] p-2 text-[var(--button-destructive-text)] opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--button-destructive-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-error)]"
                        aria-label="Delete project"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
