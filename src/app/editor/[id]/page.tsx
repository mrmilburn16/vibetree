"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject, addProjectToCache } from "@/lib/projects";
import { EditorLayout } from "@/components/editor/EditorLayout";
import type { Project } from "@/lib/projects";

export default function EditorPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const fromCache = getProject(id);
    if (fromCache) {
      setProject(fromCache);
      return;
    }
    // Project may have just been created; fetch from API and add to cache
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(id)}`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return null;
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body?.disabled) {
            if (!cancelled) setDisabled(true);
          } else {
            if (!cancelled) setNotFound(true);
          }
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: { id?: string; name?: string; bundleId?: string; createdAt?: number; updatedAt?: number } | null) => {
        if (cancelled || data === null) return;
        if (!data || typeof data.id !== "string") {
          if (!cancelled) setNotFound(true);
          return;
        }
        const p: Project = {
          id: data.id,
          name: typeof data.name === "string" ? data.name : "Untitled app",
          bundleId: typeof data.bundleId === "string" ? data.bundleId : "",
          createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
          updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
        };
        addProjectToCache(p);
        setProject(p);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (disabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background-primary)] px-4 text-center">
        <div className="rounded-full bg-[var(--badge-error)]/15 p-4">
          <svg className="h-8 w-8 text-[var(--badge-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Project Disabled</h1>
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          This project has been disabled for violating our content policy. If you think this is a mistake, contact support.
        </p>
        <Link href="/dashboard">
          <button
            type="button"
            className="rounded-lg bg-[var(--button-secondary-bg)] px-4 py-2 text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]"
          >
            Back to dashboard
          </button>
        </Link>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background-primary)] px-4">
        <h1 className="text-heading-section">Project not found</h1>
        <p className="text-body-muted">This project doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href="/dashboard">
          <button
            type="button"
            className="rounded-lg bg-[var(--button-secondary-bg)] px-4 py-2 text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]"
          >
            Back to dashboard
          </button>
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)]">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--background-secondary)]" />
      </div>
    );
  }

  const refreshProject = () => {
    const p = getProject(id);
    if (p) setProject(p);
  };

  return <EditorLayout project={project} onProjectSaved={refreshProject} />;
}
