"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { ThemedTooltipContent } from "@/components/admin/ChartTooltip";
import { Button, DropdownSelect } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const MODELS = [
  { id: "opus", name: "Claude Opus 4.6", short: "Opus" },
  { id: "sonnet", name: "Claude Sonnet 4.6", short: "Sonnet" },
  { id: "gpt", name: "GPT 5.2", short: "GPT 5.2" },
] as const;

/** Default API cost per 1,000 credits (derived from typical token usage) in $ */
const DEFAULT_COST_PER_1K_CREDITS = { opus: 0.43, sonnet: 0.09, gpt: 0.13 };

/** Mock assumptions for demo: realistic SaaS with ~50k credits/mo, healthy margin */
const MOCK_ASSUMPTIONS = {
  monthlyCredits: 52_000,
  revenuePerMonth: 14_800,
  costPer1k: { opus: 0.44, sonnet: 0.095, gpt: 0.135 } as Record<ModelId, number>,
};

const TIME_PERIODS: SelectOption[] = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "12m", label: "12 months" },
];

type ModelId = (typeof MODELS)[number]["id"];

interface Scenario {
  id: string;
  name: string;
  description: string;
  mix: Record<ModelId, number>;
  volumeMultiplier: number;
  revenueMultiplier: number;
  accent: "success" | "warning" | "info" | "neutral";
}

const SCENARIO_PRESETS: Scenario[] = [
  {
    id: "baseline",
    name: "Current mix",
    description: "Your current model usage spread",
    mix: { opus: 10, sonnet: 63, gpt: 27 },
    volumeMultiplier: 1,
    revenueMultiplier: 1,
    accent: "neutral",
  },
  {
    id: "cost-optimizer",
    name: "Cost optimizer",
    description: "Shift to Sonnet-heavy mix, same revenue",
    mix: { opus: 5, sonnet: 85, gpt: 10 },
    volumeMultiplier: 1,
    revenueMultiplier: 1,
    accent: "success",
  },
  {
    id: "premium-play",
    name: "Premium play",
    description: "More Opus for premium features, higher revenue & cost",
    mix: { opus: 35, sonnet: 45, gpt: 20 },
    volumeMultiplier: 1,
    revenueMultiplier: 1.15,
    accent: "info",
  },
  {
    id: "scale-2x",
    name: "Scale 2×",
    description: "Double usage, same mix",
    mix: { opus: 10, sonnet: 63, gpt: 27 },
    volumeMultiplier: 2,
    revenueMultiplier: 2,
    accent: "info",
  },
  {
    id: "aggressive-growth",
    name: "Aggressive growth",
    description: "3× volume, slightly more Sonnet",
    mix: { opus: 8, sonnet: 72, gpt: 20 },
    volumeMultiplier: 3,
    revenueMultiplier: 2.85,
    accent: "warning",
  },
];

function useProjections(
  monthlyCredits: number,
  revenuePerMonth: number,
  costPer1k: Record<ModelId, number>,
  period: "1m" | "3m" | "12m"
) {
  const months = period === "1m" ? 1 : period === "3m" ? 3 : 12;

  return useMemo(() => {
    return SCENARIO_PRESETS.map((s) => {
      const creditsPerMonth = monthlyCredits * s.volumeMultiplier;
      const revenuePerMonthScenario = revenuePerMonth * s.revenueMultiplier;
      // Blended $ per 1k credits = (opus% * opus_cost + sonnet% * sonnet_cost + gpt% * gpt_cost) / 100
      const costPerMonth =
        (creditsPerMonth / 1000) *
        (s.mix.opus * costPer1k.opus +
          s.mix.sonnet * costPer1k.sonnet +
          s.mix.gpt * costPer1k.gpt) /
        100;
      const profitPerMonth = revenuePerMonthScenario - costPerMonth;
      const marginPct =
        revenuePerMonthScenario > 0
          ? (profitPerMonth / revenuePerMonthScenario) * 100
          : 0;
      const totalRevenue = revenuePerMonthScenario * months;
      const totalCost = costPerMonth * months;
      const totalProfit = totalRevenue - totalCost;
      return {
        ...s,
        profitPerMonth,
        costPerMonth,
        revenuePerMonth: revenuePerMonthScenario,
        marginPct,
        totalProfit,
        totalRevenue,
        totalCost,
        creditsPerMonth,
      };
    });
  }, [monthlyCredits, revenuePerMonth, costPer1k, months, period]);
}

function ScenarioCard({
  scenario,
  periodLabel,
  isHighlight,
  baselineProfit,
  isMultiMonth,
}: {
  scenario: ReturnType<typeof useProjections>[0];
  periodLabel: string;
  isHighlight?: boolean;
  baselineProfit: number;
  isMultiMonth: boolean;
}) {
  const accentBorder =
    scenario.accent === "success"
      ? "var(--semantic-success)"
      : scenario.accent === "warning"
        ? "var(--semantic-warning)"
        : scenario.accent === "info"
          ? "var(--semantic-info)"
          : "var(--border-default)";

  const delta = scenario.id !== "baseline" ? scenario.totalProfit - baselineProfit : 0;
  const showDelta = scenario.id !== "baseline" && Math.abs(delta) >= 1;

  return (
    <article
      className={`card-premium rounded-[var(--radius-lg)] border-0 border-l-4 p-5 transition-all duration-[var(--transition-normal)] hover:shadow-[0_8px 28px -4px rgba(0,0,0,0.35)] ${
        isHighlight ? "ring-2 ring-[var(--button-primary-bg)]/40 ring-offset-2 ring-offset-[var(--background-primary)]" : ""
      }`}
      style={{ borderLeftColor: accentBorder }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: accentBorder }}
              aria-hidden
            />
            {scenario.name}
          </h3>
          <p className="text-caption mt-0.5 text-[var(--text-secondary)]">
            {scenario.description}
          </p>
        </div>
      </div>
        <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex w-full justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Profit ({periodLabel})</span>
            <span
              className={`tabular-nums font-semibold ${
                scenario.totalProfit >= 0
                  ? "text-[var(--semantic-success)]"
                  : "text-[var(--semantic-error)]"
              }`}
            >
              {scenario.totalProfit >= 0 ? "" : "−"}
              ${Math.abs(scenario.totalProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          {showDelta && (
            <span
              className={`text-caption tabular-nums ${
                delta >= 0 ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"
              }`}
            >
              {delta >= 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs baseline
            </span>
          )}
        </div>
        <div className="flex justify-between text-caption text-[var(--text-secondary)]">
          <span>Margin</span>
          <span className="tabular-nums">{scenario.marginPct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-caption text-[var(--text-secondary)]">
          <span>{isMultiMonth ? "Total revenue" : "Revenue"}</span>
          <span className="tabular-nums">
            ${scenario.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between text-caption text-[var(--text-secondary)]">
          <span>{isMultiMonth ? "Total API cost" : "API cost"}</span>
          <span className="tabular-nums">
            ${scenario.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </article>
  );
}

const CHART_COLORS = [
  "var(--button-primary-bg)",
  "var(--link-default)",
  "var(--link-hover)",
];

export default function ProjectionsPage() {
  const [useMockData, setUseMockData] = useState(false);
  const [monthlyCredits, setMonthlyCredits] = useState(42800);
  const [revenuePerMonth, setRevenuePerMonth] = useState(13200);
  const [costPer1k, setCostPer1k] = useState(DEFAULT_COST_PER_1K_CREDITS);
  const [period, setPeriod] = useState<string>("12m");

  const effectiveCredits = useMockData ? MOCK_ASSUMPTIONS.monthlyCredits : monthlyCredits;
  const effectiveRevenue = useMockData ? MOCK_ASSUMPTIONS.revenuePerMonth : revenuePerMonth;
  const effectiveCostPer1k = useMockData ? MOCK_ASSUMPTIONS.costPer1k : costPer1k;

  const projections = useProjections(
    effectiveCredits,
    effectiveRevenue,
    effectiveCostPer1k,
    period as "1m" | "3m" | "12m"
  );

  const periodLabel = period === "1m" ? "1 mo" : period === "3m" ? "3 mo" : "12 mo";
  const isMultiMonth = period !== "1m";
  const bestScenario = projections.reduce((a, b) =>
    a.totalProfit >= b.totalProfit ? a : b
  );
  const baseline = projections.find((p) => p.id === "baseline")!;

  const scenarioChartData = projections.map((p) => ({
    name: p.name.replace(" 2×", " 2x").replace(" 3×", " 3x"),
    profit: Math.round(p.totalProfit),
    revenue: Math.round(p.totalRevenue),
    cost: Math.round(p.totalCost),
  }));

  const monthlyRunwayData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const rev = baseline.revenuePerMonth * month;
      const cost = baseline.costPerMonth * month;
      return {
        month: `Month ${month}`,
        revenue: Math.round(rev),
        cost: Math.round(cost),
        profit: Math.round(rev - cost),
      };
    });
  }, [baseline.revenuePerMonth, baseline.costPerMonth]);

  const costBreakdownData = useMemo(() => {
    const mix = baseline.mix;
    const creditsPerMonth = baseline.creditsPerMonth;
    return MODELS.map((m, i) => ({
      name: m.short,
      value: Math.round((creditsPerMonth * (mix[m.id] / 100) / 1000) * effectiveCostPer1k[m.id]),
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [baseline.mix, baseline.creditsPerMonth, effectiveCostPer1k]);

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--background-primary)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background-primary)]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <nav className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4" aria-label="Breadcrumb">
            <Link
              href="/admin/dashboard"
              className="text-body-muted shrink-0 rounded-[var(--radius-sm)] py-1 text-sm transition-colors hover:text-[var(--link-default)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/40 focus:ring-offset-2 focus:ring-offset-[var(--background-primary)]"
            >
              ← Dashboard
            </Link>
            <span className="text-[var(--text-tertiary)]" aria-hidden="true">·</span>
            <h1 id="projections-title" className="truncate text-heading-card">
              What you could make
            </h1>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-caption hidden text-[var(--text-tertiary)] sm:inline">Period</span>
            <DropdownSelect
              options={TIME_PERIODS}
              value={period}
              onChange={setPeriod}
              aria-label="Time period"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6" aria-labelledby="projections-title">
        {/* Hero */}
        <section
          className="card-premium relative overflow-hidden rounded-[var(--radius-xl)] border-0 p-8 sm:p-10"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(var(--accent-rgb), 0.15) 0%, transparent 55%), var(--background-secondary)`,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0,0,0,0.2), 0 16px 40px -12px rgba(0,0,0,0.4)",
          }}
        >
          <div className="relative">
            <span className="inline-block rounded-full border border-[var(--link-default)]/40 bg-[var(--link-default)]/10 px-3 py-1 text-caption font-medium uppercase tracking-wider text-[var(--link-default)]">
              Best scenario · {periodLabel}
            </span>
            <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-5xl">
              ${bestScenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-body-muted mt-1 text-sm">
              {isMultiMonth ? "Projected profit (total for period)" : "Projected profit"}
            </p>
            <p className="text-body-muted mt-1.5 text-sm">
              {bestScenario.name} → {bestScenario.marginPct.toFixed(1)}% margin
            </p>
          </div>
        </section>

        {/* Inputs */}
        <section aria-labelledby="inputs-heading" className="space-y-6">
          <h2 id="inputs-heading" className="text-heading-section border-b border-[var(--border-subtle)] pb-2 tracking-tight">
            Assumptions
          </h2>
          <p className="text-body-muted -mt-2 text-sm text-[var(--text-secondary)]">
            {useMockData
              ? "Showing demo numbers. Turn off mock data to use your own assumptions."
              : "Adjust inputs to match your API costs and usage; scenarios update live."}
          </p>
          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)]/50 px-4 py-3 transition-colors hover:border-[var(--border-subtle)]">
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--button-primary-bg)] focus:ring-2 focus:ring-[var(--button-primary-bg)]/40"
            />
            <span className="text-sm font-medium text-[var(--text-primary)]">Use mock data</span>
            <span className="text-caption text-[var(--text-tertiary)]">(demo assumptions)</span>
          </label>
          <div className="card-premium grid gap-6 rounded-[var(--radius-lg)] border-0 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="credits" className="block text-caption text-[var(--text-secondary)]">
                Monthly credits (usage)
              </label>
              <input
                id="credits"
                type="number"
                min={1000}
                step={1000}
                value={effectiveCredits}
                onChange={(e) => setMonthlyCredits(Number(e.target.value) || 1000)}
                disabled={useMockData}
                className="w-full rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] transition-[border-color,box-shadow] duration-150 focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="revenue" className="block text-caption text-[var(--text-secondary)]">
                Monthly revenue ($)
              </label>
              <input
                id="revenue"
                type="number"
                min={0}
                step={100}
                value={effectiveRevenue}
                onChange={(e) => setRevenuePerMonth(Number(e.target.value) || 0)}
                disabled={useMockData}
                className="w-full rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] transition-[border-color,box-shadow] duration-150 focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            {MODELS.map((m) => (
              <div key={m.id} className="space-y-1.5">
                <label htmlFor={`cost-${m.id}`} className="block text-caption text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-secondary)]">{m.short}</span>
                  <span className="ml-0.5 text-[var(--text-tertiary)]">($/1k credits)</span>
                </label>
                <input
                  id={`cost-${m.id}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={effectiveCostPer1k[m.id]}
                  onChange={(e) =>
                    setCostPer1k((prev) => ({
                      ...prev,
                      [m.id]: Number(e.target.value) || 0,
                    }))
                  }
                  disabled={useMockData}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] transition-[border-color,box-shadow] duration-150 focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Scenario cards */}
        <section aria-labelledby="scenarios-heading" className="space-y-6">
          <h2 id="scenarios-heading" className="text-heading-section border-b border-[var(--border-subtle)] pb-2 tracking-tight">
            Scenarios
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {projections.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                periodLabel={periodLabel}
                isHighlight={s.id === bestScenario.id}
                baselineProfit={baseline.totalProfit}
                isMultiMonth={isMultiMonth}
              />
            ))}
          </div>
        </section>

        {/* Charts */}
        <section aria-labelledby="charts-heading" className="space-y-8">
          <h2 id="charts-heading" className="text-heading-section border-b border-[var(--border-subtle)] pb-2 tracking-tight">
            Comparison & runway
          </h2>

          <figure className="chart-card-premium rounded-[var(--radius-lg)] border-0 p-6">
            <figcaption className="sr-only">
              Profit by scenario for selected period
            </figcaption>
            <p className="mb-5 text-base font-semibold tracking-tight text-[var(--text-primary)]">
              Profit by scenario ({periodLabel})
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scenarioChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="barProfitGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--link-default)" />
                      <stop offset="100%" stopColor="var(--button-primary-bg)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="var(--border-default)" vertical={false} strokeWidth={1} />
                  <XAxis
                    type="number"
                    stroke="var(--text-tertiary)"
                    fontSize={11}
                    tick={{ fill: "var(--text-secondary)" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="none"
                    fontSize={12}
                    width={124}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--text-secondary)" }}
                  />
                  <Tooltip
                    content={<ThemedTooltipContent />}
                    formatter={(value: number) => [
                      `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      "Profit",
                    ]}
                    labelFormatter={(label) => label}
                    cursor={{ fill: "var(--background-tertiary)", opacity: 0.4 }}
                  />
                  <Bar
                    dataKey="profit"
                    name="Profit"
                    fill="url(#barProfitGradient)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>

          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="chart-card-premium rounded-[var(--radius-lg)] border-0 p-6">
              <figcaption className="sr-only">
                Monthly revenue and cost over 12 months
              </figcaption>
              <p className="mb-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                12‑month runway (baseline)
              </p>
              <p className="text-caption mb-5 text-[var(--text-secondary)]">Cumulative revenue vs API cost</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyRunwayData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--semantic-success)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--semantic-success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--semantic-error)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--semantic-error)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="var(--border-default)" vertical={false} strokeWidth={1} />
                    <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={10} tick={{ fill: "var(--text-tertiary)" }} />
                    <YAxis
                      stroke="var(--text-tertiary)"
                      fontSize={11}
                      tick={{ fill: "var(--text-tertiary)" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={<ThemedTooltipContent />}
                      formatter={(value: number, name: string) => [
                        `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                        name === "Revenue" || name === "revenue" ? "Revenue" : "API cost",
                      ]}
                      labelFormatter={(label, payload) =>
                        (payload && payload[0] && (payload[0] as { payload?: { month?: string } }).payload?.month) ?? label
                      }
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "8px" }}
                      iconType="square"
                      iconSize={10}
                      formatter={(value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="var(--semantic-success)"
                      fill="url(#areaRevenue)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      name="API cost"
                      stroke="var(--semantic-error)"
                      fill="url(#areaCost)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </figure>

            <figure className="chart-card-premium rounded-[var(--radius-lg)] border-0 p-6">
              <figcaption className="sr-only">
                API cost breakdown by model (baseline mix)
              </figcaption>
              <p className="mb-5 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                API cost by model (baseline)
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="45%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {costBreakdownData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} stroke="var(--background-secondary)" strokeWidth={1.5} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ThemedTooltipContent />}
                      formatter={(value: number, name: string) => [
                        `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                        name,
                      ]}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: "10px" }}
                      formatter={(value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>}
                      iconType="circle"
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </div>
        </section>

        {/* Model mix comparison */}
        <section aria-labelledby="mix-heading" className="space-y-4">
          <h2 id="mix-heading" className="text-heading-section border-b border-[var(--border-subtle)] pb-2 tracking-tight">
            Model mix by scenario
          </h2>
          <div className="chart-card-premium overflow-x-auto rounded-[var(--radius-lg)] border-0">
            <table className="w-full min-w-[400px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--background-tertiary)]/60">
                  <th className="py-3.5 pl-4 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Scenario
                  </th>
                  {MODELS.map((m) => (
                    <th key={m.id} className="px-4 py-3.5 text-right text-xs font-semibold tabular-nums uppercase tracking-wider text-[var(--text-secondary)]">
                      {m.short}
                    </th>
                  ))}
                  <th className="pl-4 pr-4 py-3.5 text-right text-xs font-semibold tabular-nums uppercase tracking-wider text-[var(--text-secondary)]">
                    Est. cost/mo
                  </th>
                </tr>
              </thead>
              <tbody>
                {projections.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-[var(--border-subtle)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--background-tertiary)]/50 ${
                      i % 2 === 1 ? "bg-[var(--background-primary)]/30" : ""
                    }`}
                  >
                    <td className="py-3 pl-4 pr-4 font-medium text-[var(--text-primary)]">
                      {s.name}
                    </td>
                    {MODELS.map((m) => (
                      <td key={m.id} className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {s.mix[m.id]}%
                      </td>
                    ))}
                    <td className="pl-4 pr-4 py-3 text-right tabular-nums text-[var(--text-primary)]">
                      ${s.costPerMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
