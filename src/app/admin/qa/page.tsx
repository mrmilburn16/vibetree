"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ClipboardCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Wrench,
  FileCode2,
  Zap,
  Shield,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";

type TagCount = {
  tag: string;
  count: number;
  severity: "critical" | "major" | "minor";
  buildIds: string[];
};

type SkillIssue = {
  skillId: string;
  tags: TagCount[];
  totalIssues: number;
};

type TierIssue = {
  tier: string;
  tags: TagCount[];
  totalIssues: number;
};

type SuggestionType = "prompt_rule" | "skill_update" | "fixswift_rule";

type SystemFixSuggestion = {
  type: SuggestionType;
  priority: number;
  tag: string;
  count: number;
  description: string;
  suggestedRule: string;
  targetFile: string;
  affectedSkills: string[];
};

type QAInsights = {
  totalBuildsWithNotes: number;
  totalBuilds: number;
  topTags: TagCount[];
  skillIssues: SkillIssue[];
  tierIssues: TierIssue[];
  suggestions: SystemFixSuggestion[];
};

type AppliedRule = {
  id: string;
  tag: string;
  description: string;
  rule: string;
  type: SuggestionType;
  affectedSkills: string[];
  active: boolean;
  appliedAt: string;
};

function severityIcon(s: string) {
  if (s === "critical") return <AlertCircle className="h-4 w-4 text-red-400" aria-hidden />;
  if (s === "major") return <AlertTriangle className="h-4 w-4 text-yellow-400" aria-hidden />;
  return <Info className="h-4 w-4 text-sky-400" aria-hidden />;
}

function severityBadge(s: string) {
  const colors =
    s === "critical"
      ? "bg-red-400/10 text-red-400 border-red-400/20"
      : s === "major"
        ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20"
        : "bg-sky-400/10 text-sky-400 border-sky-400/20";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors}`}>
      {s}
    </span>
  );
}

function typeIcon(type: SuggestionType) {
  if (type === "prompt_rule") return <FileCode2 className="h-4 w-4 text-purple-400" aria-hidden />;
  if (type === "skill_update") return <Zap className="h-4 w-4 text-emerald-400" aria-hidden />;
  return <Wrench className="h-4 w-4 text-orange-400" aria-hidden />;
}

function typeBadge(type: SuggestionType) {
  const labels: Record<SuggestionType, string> = {
    prompt_rule: "Prompt Rule",
    skill_update: "Skill Update",
    fixswift_rule: "fixSwift Rule",
  };
  const colors: Record<SuggestionType, string> = {
    prompt_rule: "bg-purple-400/10 text-purple-400 border-purple-400/20",
    skill_update: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    fixswift_rule: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--background-tertiary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}

function TagBar({ tag }: { tag: TagCount }) {
  const label = tag.tag.replace(/_/g, " ");
  return (
    <div className="flex items-center gap-3">
      {severityIcon(tag.severity)}
      <span className="min-w-[160px] text-sm text-[var(--text-primary)]">{label}</span>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--background-tertiary)]">
          <div
            className={`h-full rounded-full transition-all ${
              tag.severity === "critical"
                ? "bg-red-400"
                : tag.severity === "major"
                  ? "bg-yellow-400"
                  : "bg-sky-400"
            }`}
            style={{ width: `${Math.min(tag.count * 20, 100)}%` }}
          />
        </div>
      </div>
      <span className="w-8 text-right text-xs font-bold text-[var(--text-secondary)]">{tag.count}</span>
      {severityBadge(tag.severity)}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--background-tertiary)]"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        {title}
        <span className="flex-1" />
        {badge}
      </button>
      {open && <div className="border-t border-[var(--border-default)] px-4 py-3">{children}</div>}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  appliedRules,
  onApply,
}: {
  suggestion: SystemFixSuggestion;
  appliedRules: AppliedRule[];
  onApply: (s: SystemFixSuggestion) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const label = suggestion.tag.replace(/_/g, " ");

  const alreadyApplied = appliedRules.some(
    (r) => r.tag === suggestion.tag && r.active
  );

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(suggestion);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
      <div className="flex flex-wrap items-start gap-2">
        {typeIcon(suggestion.type)}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{suggestion.description}</span>
            {typeBadge(suggestion.type)}
            {severityBadge(suggestion.count >= 3 ? "critical" : suggestion.count >= 2 ? "major" : "minor")}
            {alreadyApplied && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Applied
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Issue: <span className="font-medium text-[var(--text-secondary)]">{label}</span>
            {" "}&middot; {suggestion.count} occurrence{suggestion.count !== 1 ? "s" : ""}
            {suggestion.affectedSkills.length > 0 && (
              <>
                {" "}&middot; Skills: {suggestion.affectedSkills.join(", ")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!alreadyApplied && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {applying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Shield className="h-3 w-3" />
              )}
              Apply
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-[var(--link-default)] hover:underline"
          >
            {expanded ? "Hide" : "View"} rule
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="rounded-[var(--radius-sm)] bg-[var(--background-tertiary)] p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Suggested rule for {suggestion.targetFile}
            </p>
            <p className="whitespace-pre-wrap text-xs text-[var(--text-primary)] leading-relaxed">
              {suggestion.suggestedRule}
            </p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={suggestion.suggestedRule} label="Copy Rule" />
            <CopyButton
              text={`- ${suggestion.description}: ${suggestion.suggestedRule}`}
              label="Copy as Prompt Line"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function QAInsightsPage() {
  const [data, setData] = useState<QAInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedRules, setAppliedRules] = useState<AppliedRule[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchAppliedRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/qa-rules");
      if (res.ok) {
        const json = await res.json();
        setAppliedRules(json.rules ?? []);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/qa-insights");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    fetchAppliedRules();
  }, [fetchInsights, fetchAppliedRules]);

  const handleApplyRule = useCallback(
    async (s: SystemFixSuggestion) => {
      setApplyError(null);
      const res = await fetch("/api/admin/qa-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          tag: s.tag,
          description: s.description,
          rule: s.suggestedRule,
          type: s.type,
          affectedSkills: s.affectedSkills,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        setApplyError(json.error ?? "Failed to apply rule");
        return;
      }
      await fetchAppliedRules();
    },
    [fetchAppliedRules]
  );

  const handleToggleRule = useCallback(
    async (ruleId: string, active: boolean) => {
      await fetch("/api/admin/qa-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", ruleId, active }),
      });
      await fetchAppliedRules();
    },
    [fetchAppliedRules]
  );

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      await fetch("/api/admin/qa-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ruleId }),
      });
      await fetchAppliedRules();
    },
    [fetchAppliedRules]
  );

  const copyFullReport = useCallback(() => {
    if (!data) return;
    const lines: string[] = [
      "## QA Insights Report",
      "",
      `Builds with notes: ${data.totalBuildsWithNotes} / ${data.totalBuilds}`,
      "",
      "### Top Issues",
      ...data.topTags.map(
        (t) =>
          `- [${t.severity.toUpperCase()}] ${t.tag.replace(/_/g, " ")} (${t.count}x)`
      ),
      "",
      "### Suggested System Fixes",
      ...data.suggestions.map(
        (s) =>
          `- **${s.description}** [${s.type}] (${s.count}x)\n  Rule: ${s.suggestedRule}\n  File: ${s.targetFile}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.topTags.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-[var(--link-default)]" aria-hidden />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">QA Insights</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              {data.totalBuildsWithNotes} builds with notes / {data.totalBuilds} total
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copyFullReport} disabled={!hasData}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy Report
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchInsights}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-12 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">No QA notes yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-tertiary)]">
            Test apps in Xcode, then go to Builds and paste your notes on each build result.
            Issue tags and improvement suggestions will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Top Issues */}
          <CollapsibleSection
            title="Top Issues (all builds)"
            defaultOpen
            badge={
              <span className="rounded-full bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                {data.topTags.length} types
              </span>
            }
          >
            <div className="space-y-2.5">
              {data.topTags.map((t) => (
                <TagBar key={t.tag} tag={t} />
              ))}
            </div>
          </CollapsibleSection>

          {/* By Tier */}
          {data.tierIssues.length > 0 && (
            <CollapsibleSection
              title="Issues by Tier"
              badge={
                <span className="rounded-full bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                  {data.tierIssues.length} tiers
                </span>
              }
            >
              <div className="space-y-4">
                {data.tierIssues.map((ti) => (
                  <div key={ti.tier}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {ti.tier} ({ti.totalIssues} issue{ti.totalIssues !== 1 ? "s" : ""})
                    </h4>
                    <div className="space-y-1.5">
                      {ti.tags.slice(0, 5).map((t) => (
                        <TagBar key={t.tag} tag={t} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* By Skill */}
          {data.skillIssues.length > 0 && (
            <CollapsibleSection
              title="Issues by Skill"
              badge={
                <span className="rounded-full bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                  {data.skillIssues.length} skills
                </span>
              }
            >
              <div className="space-y-4">
                {data.skillIssues.map((si) => (
                  <div key={si.skillId}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {si.skillId} ({si.totalIssues} issue{si.totalIssues !== 1 ? "s" : ""})
                    </h4>
                    <div className="space-y-1.5">
                      {si.tags.slice(0, 5).map((t) => (
                        <TagBar key={t.tag} tag={t} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Suggested System Fixes */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" aria-hidden />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Suggested System Fixes</h2>
              <span className="rounded-full bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                {data.suggestions.length}
              </span>
            </div>

            {applyError && (
              <div className="mb-3 rounded-[var(--radius-md)] border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-sm text-yellow-300">
                {applyError}
                <button
                  type="button"
                  onClick={() => setApplyError(null)}
                  className="ml-2 font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {data.suggestions.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">
                No actionable suggestions yet. Add more QA notes to builds.
              </p>
            ) : (
              <div className="space-y-3">
                {data.suggestions.map((s, i) => (
                  <SuggestionCard
                    key={`${s.tag}-${i}`}
                    suggestion={s}
                    appliedRules={appliedRules}
                    onApply={handleApplyRule}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Applied Rules */}
      <CollapsibleSection
        title="Applied QA Rules"
        defaultOpen={appliedRules.length > 0}
        badge={
          <span className="rounded-full bg-[var(--background-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
            {appliedRules.filter((r) => r.active).length} active / {appliedRules.length} total
          </span>
        }
      >
        {appliedRules.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--text-tertiary)]">
            No rules applied yet. Click &ldquo;Apply&rdquo; on a suggestion above to inject it into all future generations.
          </p>
        ) : (
          <div className="space-y-2">
            {appliedRules.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-[var(--radius-md)] border p-3 transition-colors ${
                  rule.active
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-[var(--border-default)] bg-[var(--background-tertiary)] opacity-60"
                }`}
              >
                <div className="flex items-start gap-2">
                  {rule.active ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {rule.description}
                      </span>
                      {typeBadge(rule.type)}
                      {!rule.active && (
                        <span className="rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)] line-clamp-2">
                      {rule.rule}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                      {rule.tag.replace(/_/g, " ")}
                      {rule.affectedSkills.length > 0 && ` · ${rule.affectedSkills.join(", ")}`}
                      {" · "}Applied {new Date(rule.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id, !rule.active)}
                      title={rule.active ? "Disable rule" : "Enable rule"}
                      className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      {rule.active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      title="Delete rule permanently"
                      className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
