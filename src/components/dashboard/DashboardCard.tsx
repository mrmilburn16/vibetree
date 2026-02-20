"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import type { Project } from "@/lib/projects";

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
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

const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconApp = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="2" width="16" height="20" rx="2.5" />
    <path d="M9 6h6" />
    <path d="M9 10h6" />
    <path d="M9 14h4" />
  </svg>
);

interface DashboardCardProps {
  project: Project;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onDuplicate: (e: React.MouseEvent, id: string) => void;
}

export function DashboardCard({ project, onDelete, onDuplicate }: DashboardCardProps) {
  return (
    <Link
      href={`/editor/${project.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)] rounded-[var(--radius-lg)]"
    >
      <Card className="dashboard-card-hover dashboard-card-accent group flex h-full flex-col gap-3 overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--text-tertiary)]">
            <IconApp />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-heading-card truncate">{project.name}</h2>
            <p className="text-caption mt-0.5">
              Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(e, project.id); }}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-secondary)] opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--background-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)]"
              aria-label="Duplicate project"
            >
              <IconCopy />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(e, project.id); }}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--button-destructive-text)] opacity-60 transition-opacity hover:opacity-100 hover:bg-[var(--button-destructive-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-error)]"
              aria-label="Delete project"
            >
              <IconTrash />
            </button>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--button-primary-text)] transition-colors group-hover:bg-[var(--button-primary-hover)]">
            Open <IconArrowRight />
          </span>
        </div>
      </Card>
    </Link>
  );
}

interface NewAppCardProps {
  onClick: () => void;
  index: number;
}

export function NewAppCard({ onClick, index }: NewAppCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-card-hover dashboard-new-app-card group flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-default)] bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-colors hover:border-[var(--button-primary-bg)]/50 hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)] animate-stagger-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--background-tertiary)] text-[var(--text-tertiary)] transition-transform group-hover:scale-110 group-hover:bg-[var(--button-primary-bg)]/20 group-hover:text-[var(--link-default)]">
        <IconPlus />
      </span>
      <span className="text-sm font-semibold">New app</span>
      <span className="text-caption text-xs">Start from scratch</span>
    </button>
  );
}
