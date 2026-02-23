"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  Cpu,
  FileCode2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui";

type SkillSummary = {
  id: string;
  name: string;
  frameworks: string[];
  version: number;
  keywordCount: number;
  antiPatternCount: number;
  canonicalCodeFiles: string[];
  stats: {
    totalBuilds: number;
    firstAttemptCompile: number;
    compileRate: number;
    functionalSuccesses: number;
    functionalRate: number;
    commonErrors: string[];
    goldenExamples: Array<{
      buildResultId: string;
      timestamp: string;
    }>;
  };
};

function healthColor(rate: number): string {
  if (rate >= 90) return "text-green-400";
  if (rate >= 70) return "text-yellow-400";
  return "text-red-400";
}

function healthBg(rate: number): string {
  if (rate >= 90) return "bg-green-400/10 border-green-400/20";
  if (rate >= 70) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
}

function healthLabel(rate: number): string {
  if (rate >= 90) return "Healthy";
  if (rate >= 70) return "Needs Work";
  return "Critical";
}

export default function SkillsDashboardPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "compileRate" | "totalBuilds">("name");

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkills(data.skills ?? []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const sorted = [...skills].sort((a, b) => {
    if (sortBy === "compileRate") {
      return (a.stats.totalBuilds > 0 ? a.stats.compileRate : 101) -
        (b.stats.totalBuilds > 0 ? b.stats.compileRate : 101);
    }
    if (sortBy === "totalBuilds") return b.stats.totalBuilds - a.stats.totalBuilds;
    return a.name.localeCompare(b.name);
  });

  const totalBuilds = skills.reduce((s, sk) => s + sk.stats.totalBuilds, 0);
  const avgCompileRate =
    skills.length > 0
      ? Math.round(
          skills.reduce((s, sk) => s + (sk.stats.totalBuilds > 0 ? sk.stats.compileRate : 0), 0) /
            Math.max(1, skills.filter((sk) => sk.stats.totalBuilds > 0).length),
        )
      : 0;
  const totalGolden = skills.reduce((s, sk) => s + sk.stats.goldenExamples.length, 0);

  return (
    <div className="min-h-screen bg-[var(--background-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-semibold">Skills Health</h1>
          </div>
          <Button
            onClick={fetchSkills}
            variant="secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background-secondary)] p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
              <Cpu className="h-4 w-4" />
              Total Skills
            </div>
            <div className="text-3xl font-bold">{skills.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background-secondary)] p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
              <BarChart3 className="h-4 w-4" />
              Total Skill Builds
            </div>
            <div className="text-3xl font-bold">{totalBuilds}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background-secondary)] p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
              <Zap className="h-4 w-4" />
              Avg Compile Rate
            </div>
            <div className={`text-3xl font-bold ${totalBuilds > 0 ? healthColor(avgCompileRate) : ""}`}>
              {totalBuilds > 0 ? `${avgCompileRate}%` : "--"}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background-secondary)] p-5">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
              <Trophy className="h-4 w-4" />
              Golden Examples
            </div>
            <div className="text-3xl font-bold">{totalGolden}</div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">Sort by:</span>
          {(["name", "compileRate", "totalBuilds"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                sortBy === key
                  ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]"
                  : "bg-[var(--background-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
              }`}
            >
              {key === "name" ? "Name" : key === "compileRate" ? "Compile Rate" : "Total Builds"}
            </button>
          ))}
        </div>

        {/* Skills Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : skills.length === 0 ? (
          <div className="py-20 text-center text-[var(--text-muted)]">
            No skills found. Add skill JSON files to data/skills/.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillSummary }) {
  const [expanded, setExpanded] = useState(false);
  const { stats } = skill;
  const hasData = stats.totalBuilds > 0;

  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background-secondary)] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-[var(--background-tertiary)] transition-colors"
      >
        {/* Health indicator */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${
            hasData ? healthBg(stats.compileRate) : "bg-[var(--background-tertiary)] border-[var(--border-subtle)]"
          }`}
        >
          {!hasData ? (
            <AlertTriangle className="h-5 w-5 text-[var(--text-muted)]" />
          ) : stats.compileRate >= 90 ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : stats.compileRate >= 70 ? (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
        </div>

        {/* Name & frameworks */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{skill.name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {skill.frameworks.join(", ")} &middot; v{skill.version} &middot;{" "}
            {skill.keywordCount} keywords &middot; {skill.antiPatternCount} anti-patterns &middot;{" "}
            {skill.canonicalCodeFiles.length} code patterns
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm flex-shrink-0">
          <div className="text-center">
            <div className="text-[var(--text-muted)] text-xs">Builds</div>
            <div className="font-semibold">{stats.totalBuilds}</div>
          </div>
          <div className="text-center">
            <div className="text-[var(--text-muted)] text-xs">Compile</div>
            <div className={`font-semibold ${hasData ? healthColor(stats.compileRate) : ""}`}>
              {hasData ? `${stats.compileRate}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[var(--text-muted)] text-xs">Functional</div>
            <div className={`font-semibold ${hasData && stats.functionalRate > 0 ? healthColor(stats.functionalRate) : ""}`}>
              {hasData && stats.functionalRate > 0 ? `${stats.functionalRate}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[var(--text-muted)] text-xs">Golden</div>
            <div className="font-semibold">{stats.goldenExamples.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
              backgroundColor: hasData
                ? stats.compileRate >= 90 ? "rgba(74,222,128,0.15)" : stats.compileRate >= 70 ? "rgba(250,204,21,0.15)" : "rgba(248,113,113,0.15)"
                : "rgba(148,163,184,0.15)",
              color: hasData
                ? stats.compileRate >= 90 ? "rgb(74,222,128)" : stats.compileRate >= 70 ? "rgb(250,204,21)" : "rgb(248,113,113)"
                : "rgb(148,163,184)",
            }}>
              {hasData ? healthLabel(stats.compileRate) : "No Data"}
            </div>
          </div>
        </div>

        <svg
          className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-4">
          {/* Canonical code files */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Canonical Code Patterns
            </h4>
            <div className="flex flex-wrap gap-2">
              {skill.canonicalCodeFiles.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--background-tertiary)] px-3 py-1.5 text-xs"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Common errors */}
          {stats.commonErrors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Common Errors ({stats.commonErrors.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {stats.commonErrors.slice(0, 10).map((err, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-red-400/5 border border-red-400/10 px-3 py-2 text-xs font-mono text-red-300 truncate"
                  >
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Golden examples */}
          {stats.goldenExamples.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Golden Examples ({stats.goldenExamples.length})
              </h4>
              <div className="space-y-1">
                {stats.goldenExamples.map((ex) => (
                  <div
                    key={ex.buildResultId}
                    className="flex items-center gap-2 rounded-lg bg-green-400/5 border border-green-400/10 px-3 py-2 text-xs"
                  >
                    <Trophy className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-mono text-[var(--text-secondary)]">{ex.buildResultId}</span>
                    <span className="text-[var(--text-muted)]">{new Date(ex.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasData && (
            <div className="text-sm text-[var(--text-muted)] italic">
              No builds have used this skill yet. Build an app that matches its keywords to start collecting data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
