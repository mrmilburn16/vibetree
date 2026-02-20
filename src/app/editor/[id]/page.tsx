"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject } from "@/lib/projects";
import { EditorLayout } from "@/components/editor/EditorLayout";
import type { Project } from "@/lib/projects";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const p = getProject(id);
    if (!p) {
      setNotFound(true);
      return;
    }
    setProject(p);
  }, [id]);

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

  return <EditorLayout project={project} />;
}
