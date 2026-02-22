"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, CheckCircle, Info, ThumbsDown, ThumbsUp } from "lucide-react";
import { ThemedTooltipContent } from "@/components/admin/ChartTooltip";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const RANGES: SelectOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

/** Chart palette aligned with Twilight Violet tokens (4 colors for pies with 4 segments) */
const CHART_COLORS = [
  "var(--button-primary-bg)",   // #6366F1
  "var(--link-default)",        // #818CF8
  "var(--link-hover)",          // #A5B4FC
  "var(--semantic-info)",       // distinct 4th for donuts
];


/** Mock distribution of which model users pick for prompts (sums to 100%) */
const PROMPT_MODEL_PREFERENCE = [
  { id: "auto", label: "Auto", percent: 38, description: "Let the app choose" },
  { id: "claude-opus", label: "Claude Opus 4.6", percent: 28, description: "Most capable" },
  { id: "claude-sonnet", label: "Claude Sonnet 4.6", percent: 22, description: "Balanced" },
  { id: "gpt", label: "GPT 5.2", percent: 12, description: "Alternative" },
] as const;

/** Format YYYY-MM-DD for chart axis (e.g. "Feb 21") */
function formatChartDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/** High-contrast label for pie segments (readable on dark theme) */
function PieLabel(props: { name?: string; percent?: number; x?: number; y?: number }) {
  const { name = "", percent = 0, x = 0, y = 0 } = props;
  return (
    <text
      x={x}
      y={y}
      fill="var(--text-primary)"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      className="font-medium"
    >
      {name} {((percent ?? 0) * 100).toFixed(0)}%
    </text>
  );
}


interface AdminAlert {
  id: string;
  type: string;
  title: string;
  message: string;
}

type Stats = Awaited<ReturnType<typeof fetchStats>>;

async function fetchStats(range: string) {
  const res = await fetch(`/api/admin/stats?range=${range}`);
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

function KpiCard({
  title,
  value,
  sub,
  trend,
  trendUpGood = true,
  status,
}: {
  title: string;
  value: ReactNode;
  sub?: string;
  trend?: number;
  trendUpGood?: boolean;
  status?: "success" | "warning" | "error" | "info";
}) {
  const statusColor =
    status === "success"
      ? "var(--semantic-success)"
      : status === "warning"
        ? "var(--semantic-warning)"
        : status === "error"
          ? "var(--semantic-error)"
          : status === "info"
            ? "var(--semantic-info)"
            : undefined;
  const trendPositive = trend !== undefined && trend >= 0 === trendUpGood;
  const trendLabel =
    trend !== undefined
      ? `${trend >= 0 ? "Up" : "Down"} ${Math.abs(trend).toFixed(1)}% vs previous period`
      : undefined;
  return (
    <article
      className="cursor-default rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5 transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-[var(--border-subtle)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
      style={statusColor ? { borderLeftWidth: 4, borderLeftColor: statusColor } : undefined}
    >
      <p className="text-caption text-[var(--text-secondary)]" id={`kpi-${title.replace(/\s+/g, "-")}`}>
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
      {sub && <p className="text-body-muted mt-0.5 text-sm">{sub}</p>}
      {trend !== undefined && (
        <p
          className={`text-caption mt-1 tabular-nums ${trendPositive ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}`}
          role="status"
          aria-label={trendLabel}
        >
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}% vs previous period
        </p>
      )}
    </article>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<string>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStats(range)
      .then(setStats)
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[var(--background-primary)]" role="status" aria-live="polite" aria-label="Loading dashboard">
        <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="h-6 w-32 animate-pulse rounded bg-[var(--background-tertiary)]" />
            <div className="h-9 w-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--background-tertiary)]" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          <section className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded bg-[var(--background-tertiary)]" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-[var(--background-secondary)]"
                />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-[var(--radius-lg)] bg-[var(--background-secondary)]" />
          </section>
        </main>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--background-primary)] px-4" role="alert">
        <p className="text-center text-sm text-[var(--text-secondary)]">We couldn’t load the dashboard.</p>
        <p className="text-center text-[var(--semantic-error)]">{error || "No data"}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const prev = stats.prevPeriod;
  const revenueTrend = prev ? ((stats.revenue.total - prev.revenue) / prev.revenue) * 100 : 0;
  const costTrend = prev ? ((stats.cost.total - prev.cost) / prev.cost) * 100 : 0;
  const marginTrend = prev ? stats.profit.marginPct - prev.marginPct : 0;
  const feedbackTotalTrend =
    prev && typeof prev.feedbackTotal === "number" && prev.feedbackTotal > 0
      ? ((stats.feedback.total - prev.feedbackTotal) / prev.feedbackTotal) * 100
      : undefined;
  const prevFeedbackUpRate =
    prev && typeof prev.feedbackUpRatePct === "number" ? prev.feedbackUpRatePct : undefined;
  const feedbackUpRateDelta =
    prevFeedbackUpRate !== undefined ? stats.feedback.upRatePct - prevFeedbackUpRate : undefined;

  const costByModelData = Object.entries(stats.cost.byModel).map(([name, value], i) => ({
    name: name.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2"),
    value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const alertColors = {
    warning: "var(--semantic-warning)",
    error: "var(--semantic-error)",
    success: "var(--semantic-success)",
    info: "var(--semantic-info)",
  };

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background-primary)]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/dashboard"
              className="text-body-muted shrink-0 text-sm transition-colors hover:text-[var(--link-default)]"
            >
              ← App
            </Link>
            <span className="text-[var(--text-tertiary)]" aria-hidden>·</span>
            <Link
              href="/admin/dashboard/projections"
              className="text-body-muted shrink-0 text-sm transition-colors hover:text-[var(--link-default)]"
            >
              Projections
            </Link>
            <div className="min-w-0">
              <h1 id="admin-dashboard-title" className="text-heading-card truncate">Admin dashboard</h1>
              <p className="text-caption text-[var(--text-secondary)]" aria-live="polite">
                Period: {rangeLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <DropdownSelect
              options={RANGES}
              value={range}
              onChange={setRange}
              aria-label="Time range"
            />
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                fetch("/api/admin/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                }).then(() => { window.location.href = "/admin"; });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6" aria-labelledby="admin-dashboard-title">
        {/* Alerts */}
        {stats.alerts.filter((a: AdminAlert) => !dismissedAlerts.has(a.id)).length > 0 && (
          <section aria-labelledby="alerts-heading" className="space-y-3">
            <h2 id="alerts-heading" className="text-heading-card">Alerts</h2>
            <div className="space-y-2">
              {stats.alerts
                .filter((a: AdminAlert) => !dismissedAlerts.has(a.id))
                .map((a: AdminAlert) => {
                  const AlertIcon =
                    a.type === "warning"
                      ? AlertTriangle
                      : a.type === "error"
                        ? AlertCircle
                        : a.type === "success"
                          ? CheckCircle
                          : Info;
                  return (
                  <div
                    key={a.id}
                    role="status"
                    className="flex items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4 transition-opacity"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: alertColors[a.type as keyof typeof alertColors] || alertColors.info,
                    }}
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <AlertIcon
                        className="mt-0.5 shrink-0 size-4"
                        style={{ color: alertColors[a.type as keyof typeof alertColors] || alertColors.info }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text-primary)]">{a.title}</p>
                        <p className="text-body-muted mt-0.5 text-sm">{a.message}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setDismissedAlerts((s) => new Set(s).add(a.id))}
                      className="shrink-0 text-sm text-[var(--text-secondary)]"
                      aria-label={`Dismiss alert: ${a.title}`}
                    >
                      Dismiss
                    </Button>
                  </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* 1. Revenue & cost */}
        <section aria-labelledby="revenue-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="revenue-heading" className="text-heading-section">Revenue & cost</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total revenue"
              value={`$${(stats.revenue.total / 1000).toFixed(1)}k`}
              sub={
                stats.revenue.oneTime > 0
                  ? `MRR $${(stats.revenue.mrr / 1000).toFixed(1)}k + one-time $${stats.revenue.oneTime}`
                  : `MRR $${(stats.revenue.mrr / 1000).toFixed(1)}k`
              }
              trend={revenueTrend}
              trendUpGood={true}
            />
            <KpiCard
              title="LLM cost"
              value={`$${(stats.cost.total / 1000).toFixed(2)}k`}
              trend={costTrend}
              trendUpGood={false}
            />
            <KpiCard
              title="Gross profit"
              value={`$${(stats.profit.gross / 1000).toFixed(2)}k`}
              status={
                stats.profit.marginPct < 0
                  ? "error"
                  : stats.profit.marginPct < 10
                    ? "warning"
                    : "success"
              }
            />
            <KpiCard
              title="Gross margin"
              value={`${stats.profit.marginPct.toFixed(1)}%`}
              trend={marginTrend}
              trendUpGood={true}
              status={
                stats.profit.marginPct < 0
                  ? "error"
                  : stats.profit.marginPct < 10
                    ? "warning"
                    : "success"
              }
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Revenue and cost over time</p>
            <figure className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4" style={{ height: 288 }}>
              <figcaption className="sr-only">Revenue and cost over time for the selected period</figcaption>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.revenue.byDay.map((d: { date: string; value: number }, i: number) => ({
                  ...d,
                  cost: stats.cost.byDay[i]?.value ?? 0,
                }))}
                margin={{ top: 16, right: 16, left: 16, bottom: 16 }}
                aria-label="Revenue and cost line chart"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={true} horizontal={true} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tick={{ fill: "var(--text-secondary)" }} tickFormatter={formatChartDate} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tick={{ fill: "var(--text-secondary)" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<ThemedTooltipContent />} formatter={(value: number | undefined) => [value != null ? `$${value}` : "", ""]} />
                <Legend wrapperStyle={{ paddingTop: 8 }} iconType="line" iconSize={10} style={{ fontSize: 12 }} formatter={(value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>} />
                <Line type="monotone" dataKey="value" name="Revenue" stroke="var(--semantic-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" name="Cost" stroke="var(--semantic-error)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </figure>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Cost by model</p>
            <figure className="h-56 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
              <figcaption className="sr-only">Cost breakdown by LLM model</figcaption>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByModelData} layout="vertical" margin={{ top: 12, right: 24, left: 88, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tick={{ fill: "var(--text-secondary)" }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} tick={{ fill: "var(--text-secondary)" }} width={84} />
                  <Tooltip content={<ThemedTooltipContent />} formatter={(value: number | undefined) => [value != null ? `$${value}` : "", "Cost"]} />
                  <Bar dataKey="value" name="Cost" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          </div>
        </section>

        {/* 2. Usage & credits */}
        <section aria-labelledby="usage-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="usage-heading" className="text-heading-section">Usage & credits</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard title="Credits consumed" value={stats.credits.consumed.toLocaleString()} />
            <KpiCard title="Credits granted" value={stats.credits.granted.toLocaleString()} />
            <KpiCard
              title="Usage rate"
              value={`${stats.credits.usageRatePct.toFixed(1)}%`}
              sub="Consumed ÷ granted"
              status={
                stats.credits.usageRatePct > 90
                  ? "warning"
                  : stats.credits.usageRatePct > 70
                    ? "info"
                    : undefined
              }
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Credits consumed by model</p>
            <figure className="h-56 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
              <figcaption className="sr-only">Credits consumed by model</figcaption>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart aria-label="Credits by model pie chart">
                <Pie
                  data={Object.entries(stats.credits.byModel).map(([name, value], i) => ({
                    name: name.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2"),
                    value,
                    fill: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--background-secondary)"
                  strokeWidth={1.5}
                  label={(props) => <PieLabel {...props} />}
                  labelLine={{ stroke: "var(--text-tertiary)" }}
                />
                <Tooltip content={<ThemedTooltipContent />} formatter={(value: number | undefined) => [value != null ? value.toLocaleString() : "", "Credits"]} />
              </PieChart>
            </ResponsiveContainer>
          </figure>
          </div>

          {/* Prompt model preference — which model users are most likely to use */}
          <div className="mt-8 space-y-4">
            <h3 id="prompt-model-preference-heading" className="text-heading-card">
              Prompt model preference
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Share of prompts sent with each model in the selected period (which model someone is most likely to use).
            </p>
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <figure className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4" style={{ minHeight: 260 }}>
                <figcaption className="sr-only">Distribution of prompt model choices, totaling 100%</figcaption>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart aria-label="Prompt model preference donut chart">
                    <Pie
                      data={PROMPT_MODEL_PREFERENCE.map((row, i) => ({
                        name: row.label,
                        value: row.percent,
                        fill: CHART_COLORS[i % CHART_COLORS.length],
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="var(--background-secondary)"
                      strokeWidth={1.5}
                      label={(props) => <PieLabel {...props} />}
                      labelLine={{ stroke: "var(--text-tertiary)" }}
                    />
                    <Tooltip content={<ThemedTooltipContent />} formatter={(value: number | undefined) => [value != null ? `${value}%` : "", "Share"]} />
                  </PieChart>
                </ResponsiveContainer>
              </figure>
              <div className="space-y-4">
                <div
                  className="relative rounded-[var(--radius-lg)] border-2 border-[var(--button-primary-bg)] bg-[var(--background-tertiary)] p-4"
                  style={{ boxShadow: "0 0 20px rgba(var(--accent-rgb), 0.15)" }}
                >
                  <span className="absolute right-3 top-3 rounded bg-[var(--button-primary-bg)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--link-default)]">
                    #1
                  </span>
                  <p className="text-caption font-medium uppercase tracking-wider text-[var(--text-secondary)]">Most likely to use</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                    {PROMPT_MODEL_PREFERENCE[0].label}
                  </p>
                  <p className="text-body-muted mt-0.5 text-sm">{PROMPT_MODEL_PREFERENCE[0].description}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--link-default)]">
                    {PROMPT_MODEL_PREFERENCE[0].percent}%
                  </p>
                </div>
                <ul className="space-y-2" aria-label="Model share breakdown">
                  {PROMPT_MODEL_PREFERENCE.map((row, i) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2 transition-colors hover:border-[var(--border-default)]"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-sm text-[var(--text-primary)]">{row.label}</span>
                      <span className="shrink-0 tabular-nums font-medium text-[var(--text-secondary)]">
                        {row.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 2.5 Build feedback */}
        <section aria-labelledby="feedback-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="feedback-heading" className="text-heading-section">Build feedback</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Feedback submissions"
              value={stats.feedback.total.toLocaleString()}
              sub="From thumbs up/down in editor"
              trend={feedbackTotalTrend}
              trendUpGood={true}
              status={stats.feedback.total === 0 ? "info" : undefined}
            />
            <KpiCard
              title="Thumbs up"
              value={
                <span className="inline-flex items-center gap-2">
                  <ThumbsUp className="size-4" style={{ color: "var(--semantic-success)" }} aria-hidden />
                  <span className="tabular-nums">{stats.feedback.up.toLocaleString()}</span>
                </span>
              }
              status={stats.feedback.up >= stats.feedback.down ? "success" : undefined}
            />
            <KpiCard
              title="Thumbs down"
              value={
                <span className="inline-flex items-center gap-2">
                  <ThumbsDown className="size-4" style={{ color: "var(--semantic-error)" }} aria-hidden />
                  <span className="tabular-nums">{stats.feedback.down.toLocaleString()}</span>
                </span>
              }
              status={stats.feedback.down > stats.feedback.up ? "warning" : undefined}
            />
            <KpiCard
              title="Up rate"
              value={`${stats.feedback.upRatePct.toFixed(1)}%`}
              sub={
                prevFeedbackUpRate !== undefined
                  ? `Prev ${prevFeedbackUpRate.toFixed(1)}% (${feedbackUpRateDelta! >= 0 ? "+" : ""}${feedbackUpRateDelta!.toFixed(1)}pp)`
                  : "👍 ÷ total"
              }
              status={
                stats.feedback.upRatePct >= 80
                  ? "success"
                  : stats.feedback.upRatePct >= 60
                    ? "warning"
                    : stats.feedback.total > 0
                      ? "error"
                      : "info"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <figure
              className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4"
              style={{ minHeight: 288 }}
            >
              <figcaption className="sr-only">Thumbs up and thumbs down by day</figcaption>
              {stats.feedback.total === 0 ? (
                <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)]">No feedback yet</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Once users click 👍 or 👎 in the editor, results will appear here.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={stats.feedback.byDay}
                    margin={{ top: 12, right: 16, left: 16, bottom: 12 }}
                    aria-label="Build feedback by day"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tick={{ fill: "var(--text-secondary)" }}
                      tickFormatter={formatChartDate}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tick={{ fill: "var(--text-secondary)" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<ThemedTooltipContent />}
                      formatter={(value, name) => [
                        typeof value === "number" ? value.toLocaleString() : value != null ? String(value) : "",
                        name === "up" ? "Thumbs up" : name === "down" ? "Thumbs down" : name ?? "",
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8 }}
                      iconType="square"
                      iconSize={10}
                      formatter={(value) => (
                        <span className="inline-flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                          {value === "up" ? (
                            <>
                              <ThumbsUp className="size-3.5" style={{ color: "var(--semantic-success)" }} aria-hidden />
                              <span>Thumbs up</span>
                            </>
                          ) : value === "down" ? (
                            <>
                              <ThumbsDown className="size-3.5" style={{ color: "var(--semantic-error)" }} aria-hidden />
                              <span>Thumbs down</span>
                            </>
                          ) : (
                            <span>{String(value)}</span>
                          )}
                        </span>
                      )}
                    />
                    <Bar dataKey="up" name="up" stackId="a" fill="var(--semantic-success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="down" name="down" stackId="a" fill="var(--semantic-error)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </figure>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5">
              <p className="text-caption font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Designer view
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Use this as a quick sentiment check:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                <li className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <ThumbsUp className="size-4" style={{ color: "var(--semantic-success)" }} aria-hidden />
                    <span>Positive</span>
                  </span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {stats.feedback.up.toLocaleString()}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <ThumbsDown className="size-4" style={{ color: "var(--semantic-error)" }} aria-hidden />
                    <span>Negative</span>
                  </span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {stats.feedback.down.toLocaleString()}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2">
                  <span>Up rate</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {stats.feedback.upRatePct.toFixed(1)}%
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-[var(--text-tertiary)]">
                Data source: editor thumbs up/down (“How did the build turn out?”).
              </p>
            </div>
          </div>
        </section>

        {/* 3. Subscriptions */}
        <section aria-labelledby="subscriptions-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="subscriptions-heading" className="text-heading-section">Subscriptions & pipeline</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard title="Active subscriptions" value={stats.subscriptions.active} />
            <KpiCard title="Upcoming renewals" value={stats.subscriptions.upcomingRenewals} />
            <KpiCard title="Trials ending" value={stats.subscriptions.trialsEnding} />
            <KpiCard
              title="Failed payments"
              value={stats.subscriptions.failedPayments}
              status={stats.subscriptions.failedPayments > 2 ? "warning" : undefined}
            />
            <KpiCard title="New (period)" value={stats.subscriptions.newSubs} />
            <KpiCard title="Churned (period)" value={stats.subscriptions.churnedSubs} />
          </div>
        </section>

        {/* 4. Growth */}
        <section aria-labelledby="growth-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="growth-heading" className="text-heading-section">Growth & cohorts</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard title="Visitor → signup %" value={`${stats.growth.conversionVisitorSignup}%`} />
            <KpiCard title="Signup → paid %" value={`${stats.growth.conversionSignupPaid}%`} />
            <KpiCard title="CAC" value={`$${stats.growth.cac}`} sub="Customer acquisition cost" />
            <KpiCard title="LTV" value={`$${stats.growth.ltv}`} sub="Lifetime value" />
            <KpiCard
              title="LTV:CAC"
              value={stats.growth.ltvCac.toFixed(1)}
              sub="Lifetime value ÷ CAC"
              status={
                stats.growth.ltvCac >= 3
                  ? "success"
                  : stats.growth.ltvCac >= 1.5
                    ? "warning"
                    : "error"
              }
            />
            <KpiCard title="Churn rate" value={`${stats.growth.churnRatePct}%`} />
          </div>
        </section>

        {/* 5. Fraud & suspicious usage */}
        <section aria-labelledby="fraud-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="fraud-heading" className="text-heading-section">Fraud & suspicious usage</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title="Flagged events (period)"
              value={stats.fraud.suspiciousCount}
              status={stats.fraud.suspiciousCount > 5 ? "warning" : stats.fraud.suspiciousCount > 0 ? "info" : undefined}
            />
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5">
              <p className="text-caption font-medium uppercase tracking-wider text-[var(--text-secondary)]">Top suspicious</p>
              {stats.fraud.flaggedUsers.length === 0 ? (
                <p className="text-body-muted mt-3 text-sm">No flagged users in this period.</p>
              ) : (
                <ul className="mt-2 space-y-2" aria-label="Flagged users">
                  {stats.fraud.flaggedUsers.map((u: { id: string; ip: string; reason: string; score: number }) => (
                    <li
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2 text-sm transition-colors hover:border-[var(--border-default)] hover:bg-[var(--background-tertiary)]/80"
                    >
                      <span className="tabular-nums text-[var(--text-primary)]">{u.ip}</span>
                      <span className="text-caption tabular-nums text-[var(--text-secondary)]">Score {u.score}</span>
                      <span className="text-caption max-w-[180px] truncate text-[var(--text-secondary)]" title={u.reason}>{u.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* 6. Forecasting */}
        <section aria-labelledby="forecasting-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="forecasting-heading" className="text-heading-section">Forecasting</h2>
            <div className="h-0.5 w-10 rounded-full bg-[var(--link-default)]/50" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              title="Projected cost (month)"
              value={`$${(stats.forecasting.projectedCostMonth / 1000).toFixed(2)}k`}
            />
            <KpiCard title="Projected revenue (month)" value={`$${(stats.forecasting.projectedRevenueMonth / 1000).toFixed(1)}k`} />
            <KpiCard
              title="Projected margin"
              value={`${stats.forecasting.projectedMarginPct.toFixed(1)}%`}
              status={
                stats.forecasting.projectedMarginPct < 0
                  ? "error"
                  : stats.forecasting.projectedMarginPct < 10
                    ? "warning"
                    : "success"
              }
            />
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Profit margin by model</p>
            <div className="flex flex-wrap gap-4" role="list">
              {(Object.entries(stats.profit.byModel) as [string, number][]).map(([model, pct]) => (
                <div
                  key={model}
                  role="listitem"
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-4 py-2 tabular-nums transition-colors hover:border-[var(--border-default)]"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      pct < 0 ? "var(--semantic-error)" : pct < 10 ? "var(--semantic-warning)" : "var(--semantic-success)",
                  }}
                >
                  <span className="text-[var(--text-primary)]">{model.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2")}</span>
                  <span className="font-medium text-[var(--text-primary)]">{pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
