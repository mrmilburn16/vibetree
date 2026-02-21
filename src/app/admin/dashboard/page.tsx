"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Cell,
} from "recharts";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
] as const;

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
  value: string | number;
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
  return (
    <div
      className="rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-5 transition hover:border-[var(--border-subtle)]"
      style={statusColor ? { borderLeftWidth: 4, borderLeftColor: statusColor } : undefined}
    >
      <p className="text-caption text-[var(--text-tertiary)]">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
        {value}
      </p>
      {sub && <p className="text-body-muted mt-0.5 text-sm">{sub}</p>}
      {trend !== undefined && (
        <p
          className={`text-caption mt-1 ${trend >= 0 === trendUpGood ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}`}
        >
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
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
      <div className="min-h-screen bg-[var(--background-primary)] p-6">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded bg-[var(--background-tertiary)]" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-[var(--background-secondary)]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)]">
        <p className="text-[var(--semantic-error)]">{error || "No data"}</p>
      </div>
    );
  }

  const prev = stats.prevPeriod;
  const revenueTrend = prev ? ((stats.revenue.total - prev.revenue) / prev.revenue) * 100 : 0;
  const costTrend = prev ? ((stats.cost.total - prev.cost) / prev.cost) * 100 : 0;
  const marginTrend = prev ? stats.profit.marginPct - prev.marginPct : 0;

  const costByModelData = Object.entries(stats.cost.byModel).map(([name, value]) => ({
    name: name.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2"),
    value,
    fill:
      name === "Claude Opus 4.6"
        ? "#6366F1"
        : name === "Claude Sonnet 4.6"
          ? "#818CF8"
          : "#A5B4FC",
  }));

  const alertColors = {
    warning: "var(--semantic-warning)",
    error: "var(--semantic-error)",
    success: "var(--semantic-success)",
    info: "var(--semantic-info)",
  };

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-body-muted hover:text-primary text-sm"
            >
              ← App
            </Link>
            <h1 className="text-heading-card">Admin dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                fetch("/api/admin/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                }).then(() => { window.location.href = "/admin"; });
              }}
              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-secondary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Alerts */}
        {stats.alerts.filter((a: AdminAlert) => !dismissedAlerts.has(a.id)).length > 0 && (
          <section>
            <h2 className="text-heading-card mb-3">Alerts</h2>
            <div className="space-y-2">
              {stats.alerts
                .filter((a: AdminAlert) => !dismissedAlerts.has(a.id))
                .map((a: AdminAlert) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-4"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: alertColors[a.type as keyof typeof alertColors] || alertColors.info,
                    }}
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{a.title}</p>
                      <p className="text-body-muted mt-0.5 text-sm">{a.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDismissedAlerts((s) => new Set(s).add(a.id))}
                      className="text-caption text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* 1. Revenue & cost */}
        <section>
          <h2 className="text-heading-section mb-4">Revenue & cost</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total revenue"
              value={`$${(stats.revenue.total / 1000).toFixed(1)}k`}
              sub={`MRR $${(stats.revenue.mrr / 1000).toFixed(1)}k + one-time $${stats.revenue.oneTime}`}
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
          <div className="mt-6 h-72 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.revenue.byDay.map((d: { date: string; value: number }, i: number) => ({
                  ...d,
                  cost: stats.cost.byDay[i]?.value ?? 0,
                }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                  }}
                  labelStyle={{ color: "var(--text-primary)" }}
                  formatter={(value: number | undefined) => [value != null ? `$${value}` : "", ""]}
                />
                <Legend />
                <Line type="monotone" dataKey="value" name="Revenue" stroke="var(--semantic-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" name="Cost" stroke="var(--semantic-error)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <p className="text-body-muted mb-2 text-sm">Cost by model</p>
            <div className="h-56 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costByModelData} layout="vertical" margin={{ top: 8, right: 24, left: 80, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis type="number" stroke="var(--text-tertiary)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-tertiary)" fontSize={11} width={76} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--background-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                    }}
                    formatter={(value: number | undefined) => [value != null ? `$${value}` : "", "Cost"]}
                  />
                  <Bar dataKey="value" name="Cost" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 2. Usage & credits */}
        <section>
          <h2 className="text-heading-section mb-4">Usage & credits</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard title="Credits consumed" value={stats.credits.consumed.toLocaleString()} />
            <KpiCard title="Credits granted" value={stats.credits.granted.toLocaleString()} />
            <KpiCard
              title="Usage rate"
              value={`${stats.credits.usageRatePct.toFixed(1)}%`}
              status={
                stats.credits.usageRatePct > 90
                  ? "warning"
                  : stats.credits.usageRatePct > 70
                    ? "info"
                    : undefined
              }
            />
          </div>
          <div className="mt-4 h-56 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(stats.credits.byModel).map(([name, value], i) => ({
                    name: name.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2"),
                    value,
                    fill: ["#6366F1", "#818CF8", "#A5B4FC"][i] as string,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                  }}
                    formatter={(value: number | undefined) => [value != null ? value.toLocaleString() : "", "Credits"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. Subscriptions */}
        <section>
          <h2 className="text-heading-section mb-4">Subscriptions & pipeline</h2>
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
        <section>
          <h2 className="text-heading-section mb-4">Growth & cohorts</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard title="Visitor → signup %" value={`${stats.growth.conversionVisitorSignup}%`} />
            <KpiCard title="Signup → paid %" value={`${stats.growth.conversionSignupPaid}%`} />
            <KpiCard title="CAC" value={`$${stats.growth.cac}`} />
            <KpiCard title="LTV" value={`$${stats.growth.ltv}`} />
            <KpiCard
              title="LTV:CAC"
              value={stats.growth.ltvCac.toFixed(1)}
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
        <section>
          <h2 className="text-heading-section mb-4">Fraud & suspicious usage</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title="Flagged events (period)"
              value={stats.fraud.suspiciousCount}
              status={stats.fraud.suspiciousCount > 5 ? "warning" : stats.fraud.suspiciousCount > 0 ? "info" : undefined}
            />
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-5">
              <p className="text-caption text-[var(--text-tertiary)]">Top suspicious</p>
              <ul className="mt-2 space-y-2">
                {stats.fraud.flaggedUsers.map((u: { id: string; ip: string; reason: string; score: number }) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--background-tertiary)] px-3 py-2 text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">{u.ip}</span>
                    <span className="text-caption text-[var(--text-tertiary)]">Score {u.score}</span>
                    <span className="text-caption max-w-[180px] truncate" title={u.reason}>{u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Forecasting & alerts */}
        <section>
          <h2 className="text-heading-section mb-4">Forecasting</h2>
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
          <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--background-secondary)] p-4">
            <p className="text-body-muted mb-2 text-sm">Profit margin by model</p>
            <div className="flex flex-wrap gap-4">
              {(Object.entries(stats.profit.byModel) as [string, number][]).map(([model, pct]) => (
                <div
                  key={model}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      pct < 0 ? "var(--semantic-error)" : pct < 10 ? "var(--semantic-warning)" : "var(--semantic-success)",
                  }}
                >
                  <span className="text-[var(--text-primary)]">{model.replace("Claude ", "").replace("GPT-5.2", "GPT 5.2")}</span>
                  <span className="font-medium">{pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
