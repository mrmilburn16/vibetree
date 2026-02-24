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
} from "lucide-react";

type ServiceStatus = "operational" | "degraded" | "down";

type Service = {
  id: string;
  name: string;
  status: ServiceStatus;
  message: string | null;
  lastChecked: string | null;
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
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  website: "Landing page, dashboard, and editor",
  "app-generation": "AI code generation pipeline",
  "xcode-builds": "iOS compilation and simulator",
};

function statusConfig(status: ServiceStatus) {
  if (status === "operational") {
    return {
      label: "Operational",
      icon: CheckCircle2,
      pillBg: "bg-emerald-500/10",
      pillText: "text-emerald-400",
      pillBorder: "border-emerald-500/20",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.08)]",
      barColor: "bg-emerald-500",
      dotPulse: true,
    };
  }
  if (status === "degraded") {
    return {
      label: "Degraded Performance",
      icon: AlertTriangle,
      pillBg: "bg-yellow-500/10",
      pillText: "text-yellow-400",
      pillBorder: "border-yellow-500/20",
      glow: "shadow-[0_0_20px_rgba(234,179,8,0.08)]",
      barColor: "bg-yellow-500",
      dotPulse: true,
    };
  }
  return {
    label: "Service Disruption",
    icon: XCircle,
    pillBg: "bg-red-500/10",
    pillText: "text-red-400",
    pillBorder: "border-red-500/20",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.1)]",
    barColor: "bg-red-500",
    dotPulse: false,
  };
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

function OverallBanner({ allOperational }: { allOperational: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-xl)] border p-6 sm:p-8 ${
        allOperational
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-yellow-500/20 bg-yellow-500/[0.04]"
      }`}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: allOperational
            ? "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(16,185,129,0.12), transparent)"
            : "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(234,179,8,0.12), transparent)",
        }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            allOperational ? "bg-emerald-500/15" : "bg-yellow-500/15"
          }`}
        >
          {allOperational ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
          )}
        </div>
        <div>
          <h2
            className={`text-lg font-bold ${
              allOperational ? "text-emerald-400" : "text-yellow-400"
            }`}
          >
            {allOperational ? "All Systems Operational" : "Some Services Experiencing Issues"}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
            {allOperational
              ? "Everything is running smoothly"
              : "We're aware and working on it"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const config = statusConfig(service.status);
  const StatusIcon = config.icon;
  const ServiceIcon = SERVICE_ICONS[service.id] ?? Server;
  const description = SERVICE_DESCRIPTIONS[service.id];

  return (
    <div
      className={`group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] transition-all duration-300 hover:border-[var(--border-subtle)] ${config.glow}`}
    >
      {/* Top color bar */}
      <div className={`h-0.5 ${config.barColor} opacity-60`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--background-tertiary)] text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-secondary)]">
              <ServiceIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</h3>
              {description && (
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>
              )}
              {service.message && (
                <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--background-tertiary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                  {service.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${config.pillBg} ${config.pillText} ${config.pillBorder}`}
            >
              <span className="relative flex h-2 w-2">
                {config.dotPulse && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.barColor}`}
                  />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${config.barColor}`} />
              </span>
              {config.label}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
              Checked {timeAgo(service.lastChecked)}
            </span>
          </div>
        </div>
      </div>
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
            <RefreshCw
              className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
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

        {data && (
          <>
            {/* Title */}
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                Service Health
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                System Status
              </h1>
            </div>

            {/* Overall banner */}
            <div className="mb-6">
              <OverallBanner allOperational={data.allOperational} />
            </div>

            {/* Global message */}
            {data.globalMessage && (
              <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--button-primary-bg)]/20 bg-[var(--button-primary-bg)]/[0.04] px-4 py-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--link-default)]" />
                <p className="text-sm text-[var(--text-secondary)]">{data.globalMessage}</p>
              </div>
            )}

            {/* Services */}
            <div className="space-y-3">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                Services
              </h2>
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
