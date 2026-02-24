"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

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

function statusConfig(status: ServiceStatus) {
  if (status === "operational") {
    return {
      label: "Operational",
      icon: CheckCircle2,
      pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-400",
    };
  }
  if (status === "degraded") {
    return {
      label: "Degraded",
      icon: AlertTriangle,
      pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
      dot: "bg-yellow-400",
    };
  }
  return {
    label: "Down",
    icon: XCircle,
    pill: "bg-red-500/15 text-red-400 border-red-500/30",
    dot: "bg-red-400",
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
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--background-primary)", color: "var(--text-primary)" }}
    >
      <header className="border-b border-[var(--border-default)] bg-[var(--background-secondary)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-[var(--text-primary)] hover:text-[var(--link-default)] transition-colors"
          >
            Vibetree
          </Link>
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`inline-block h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            Could not load status. {error}
          </div>
        )}

        {data && (
          <>
            {/* Overall status */}
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">System Status</h1>
              <p className={`mt-2 text-sm font-medium ${data.allOperational ? "text-emerald-400" : "text-yellow-400"}`}>
                {data.allOperational
                  ? "All Systems Operational"
                  : "Some Services Experiencing Issues"}
              </p>
            </div>

            {/* Global message */}
            {data.globalMessage && (
              <div className="mb-6 rounded-[var(--radius-lg)] border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
                {data.globalMessage}
              </div>
            )}

            {/* Services */}
            <div className="space-y-3">
              {data.services.map((service) => {
                const config = statusConfig(service.status);
                const Icon = config.icon;
                return (
                  <div
                    key={service.id}
                    className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] px-5 py-4"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${
                      service.status === "operational" ? "text-emerald-400" :
                      service.status === "degraded" ? "text-yellow-400" : "text-red-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</p>
                      {service.message && (
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{service.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${config.pill}`}>
                        {config.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        {timeAgo(service.lastChecked)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {loading && !data && (
          <div className="flex min-h-[300px] items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border-default)] bg-[var(--background-secondary)] py-4 text-center text-xs text-[var(--text-tertiary)]">
        <Link href="/contact" className="text-[var(--link-default)] hover:underline">
          Having issues? Contact us
        </Link>
      </footer>
    </div>
  );
}
