"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  Server,
  Cpu,
  Wrench,
  Cloud,
  Bell,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

type ServiceStatus = "operational" | "degraded" | "down";

type DayBucket = {
  date: string;
  status: ServiceStatus;
  checks: number;
  operational: number;
  degraded: number;
  down: number;
};

type SubService = {
  id: string;
  name: string;
  status: ServiceStatus;
};

type Service = {
  id: string;
  name: string;
  status: ServiceStatus;
  message: string | null;
  lastChecked: string | null;
  uptimePct: number;
  days: DayBucket[];
  subServices?: SubService[];
};

type StatusResponse = {
  services: Service[];
  globalMessage: string | null;
  allOperational: boolean;
};

const SERVICE_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  "app-generation": Cpu,
  "xcode-builds": Wrench,
  "cloud-services": Cloud,
  "push-notifications": Bell,
  authentication: ShieldCheck,
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  website: "Landing page, dashboard, and editor",
  "app-generation": "AI code generation pipeline",
  "xcode-builds": "iOS compilation and simulator",
  "cloud-services": "Firebase database, storage, and analytics",
  "push-notifications": "APNs relay for app notifications",
  authentication: "Sign in with Apple and user accounts",
};

function statusColor(status: ServiceStatus) {
  if (status === "operational") return { text: "text-emerald-400", bg: "bg-emerald-500", bgSoft: "bg-emerald-500/15", border: "border-emerald-500/20" };
  if (status === "degraded") return { text: "text-yellow-400", bg: "bg-yellow-500", bgSoft: "bg-yellow-500/15", border: "border-yellow-500/20" };
  return { text: "text-red-400", bg: "bg-red-500", bgSoft: "bg-red-500/15", border: "border-red-500/20" };
}

function statusLabel(status: ServiceStatus) {
  if (status === "operational") return "Operational";
  if (status === "degraded") return "Degraded";
  return "Down";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function barColor(status: ServiceStatus): string {
  if (status === "operational") return "var(--semantic-success)";
  if (status === "degraded") return "var(--semantic-warning)";
  return "var(--semantic-error)";
}

function noDataColor(): string {
  return "var(--border-default)";
}

function UptimeBar({ days }: { days: DayBucket[] }) {
  return (
    <div className="flex items-center gap-[2px]" role="img" aria-label="90-day uptime history">
      {days.map((day) => (
        <div
          key={day.date}
          className="group relative h-8 flex-1 rounded-[2px] transition-all hover:scale-y-110 hover:brightness-125"
          style={{
            backgroundColor: day.checks === 0 ? noDataColor() : barColor(day.status),
            opacity: day.checks === 0 ? 0.3 : 1,
            minWidth: 2,
          }}
        >
          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--background-tertiary)] border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-lg group-hover:block">
            <span className="font-medium text-[var(--text-primary)]">{day.date}</span>
            <br />
            {day.checks === 0 ? (
              <span className="text-[var(--text-tertiary)]">No data</span>
            ) : (
              <>
                {day.operational > 0 && <span className="text-emerald-400">{day.operational} ok</span>}
                {day.degraded > 0 && <span className="text-yellow-400">{day.operational > 0 ? " / " : ""}{day.degraded} slow</span>}
                {day.down > 0 && <span className="text-red-400">{(day.operational > 0 || day.degraded > 0) ? " / " : ""}{day.down} down</span>}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubServiceRow({ sub }: { sub: SubService }) {
  const colors = statusColor(sub.status);
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-[var(--text-secondary)]">{sub.name}</span>
      <span className={`flex items-center gap-1.5 text-[11px] font-medium ${colors.text}`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.bg}`} />
        {statusLabel(sub.status)}
      </span>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const [expanded, setExpanded] = useState(false);
  const colors = statusColor(service.status);
  const ServiceIcon = SERVICE_ICONS[service.id] ?? Server;
  const description = SERVICE_DESCRIPTIONS[service.id];
  const hasDays = service.days.length > 0;
  const hasData = service.days.some((d) => d.checks > 0);
  const hasSubs = service.subServices && service.subServices.length > 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] transition-colors hover:border-[var(--border-subtle)]">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${colors.bgSoft}`}>
              <ServiceIcon className={`h-4 w-4 ${colors.text}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</h3>
              {description && (
                <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {hasData && (
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                  {service.uptimePct.toFixed(service.uptimePct === 100 ? 0 : 2)}%
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Uptime</p>
              </div>
            )}
            <span className={`${colors.text} text-xs font-semibold`}>
              {statusLabel(service.status)}
            </span>
          </div>
        </div>

        {service.message && (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--background-tertiary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            {service.message}
          </p>
        )}
      </div>

      {/* Uptime bar */}
      {hasDays && (
        <div className="px-5 pb-3">
          <UptimeBar days={service.days} />
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-tertiary)]">
            <span>{service.days.length} days ago</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Sub-services expand toggle */}
      {hasSubs && (
        <div className="border-t border-[var(--border-default)]">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-[11px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            <span>{service.subServices!.length} components</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {expanded && (
            <div className="border-t border-[var(--border-default)] px-5 pb-3 pt-1 divide-y divide-[var(--border-default)]">
              {service.subServices!.map((sub) => (
                <SubServiceRow key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overallStatus: ServiceStatus | null = data
    ? data.services.some((s) => s.status === "down")
      ? "down"
      : data.services.some((s) => s.status === "degraded")
        ? "degraded"
        : "operational"
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background-primary)]">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% -10%, var(--button-primary-bg), transparent)",
        }}
      />

      <header className="relative z-10 border-b border-[var(--border-default)] bg-[var(--background-secondary)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--link-default)]"
          >
            Vibetree
          </Link>
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--background-tertiary)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            Could not load status. {error}
          </div>
        )}

        {data && overallStatus && (
          <>
            {/* Hero status indicator */}
            <div className="mb-10 flex flex-col items-center text-center">
              <div
                className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
                  overallStatus === "operational"
                    ? "bg-emerald-500/15 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
                    : overallStatus === "degraded"
                      ? "bg-yellow-500/15 shadow-[0_0_40px_rgba(234,179,8,0.2)]"
                      : "bg-red-500/15 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                }`}
              >
                {overallStatus === "operational" ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                ) : overallStatus === "degraded" ? (
                  <AlertTriangle className="h-10 w-10 text-yellow-400" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-400" />
                )}
              </div>

              <h1 className={`text-2xl font-bold sm:text-3xl ${statusColor(overallStatus).text}`}>
                {overallStatus === "operational"
                  ? "All Systems Operational"
                  : overallStatus === "degraded"
                    ? "Degraded Performance"
                    : "Service Disruption"}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">
                {overallStatus === "operational"
                  ? "Everything is running smoothly"
                  : "We're aware and working on it"}
              </p>
            </div>

            {/* Global message */}
            {data.globalMessage && (
              <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--button-primary-bg)]/20 bg-[var(--button-primary-bg)]/[0.04] px-4 py-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--link-default)]" />
                <p className="text-sm text-[var(--text-secondary)]">{data.globalMessage}</p>
              </div>
            )}

            {/* Section heading */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                Live Status
              </h2>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                Uptime over the past 90 days
              </span>
            </div>

            {/* Service cards */}
            <div className="space-y-4">
              {data.services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>

            {/* Meta */}
            <p className="mt-8 text-center text-[11px] text-[var(--text-tertiary)]">
              Auto-checked every 60 seconds
            </p>
          </>
        )}

        {loading && !data && (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--link-default)]" />
            <p className="text-sm text-[var(--text-tertiary)]">Checking services...</p>
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-[var(--border-default)] bg-[var(--background-secondary)]/80 backdrop-blur-md py-5 text-center">
        <Link
          href="/contact"
          className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--link-default)]"
        >
          Having issues? Contact us
        </Link>
      </footer>
    </div>
  );
}
