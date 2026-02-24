"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  Save,
} from "lucide-react";
import { DropdownSelect } from "@/components/ui";

type ServiceStatusValue = "operational" | "degraded" | "down";

interface AdminSubService {
  id: string;
  name: string;
  status: ServiceStatusValue;
  override: ServiceStatusValue | null;
  effectiveStatus: ServiceStatusValue;
}

interface AdminService {
  id: string;
  name: string;
  status: ServiceStatusValue;
  autoDetected: boolean;
  override: ServiceStatusValue | null;
  overrideMessage: string | null;
  lastChecked: string | null;
  lastChanged: string | null;
  effectiveStatus: ServiceStatusValue;
  subServices?: AdminSubService[];
}

interface AdminStatusResponse {
  services: AdminService[];
  globalMessage: string | null;
}

const OVERRIDE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "operational", label: "Force Operational" },
  { value: "degraded", label: "Force Degraded" },
  { value: "down", label: "Force Down" },
] as const;

function statusLabel(status: ServiceStatusValue) {
  if (status === "operational") return { label: "Operational", icon: CheckCircle2, color: "text-emerald-400" };
  if (status === "degraded") return { label: "Degraded", icon: AlertTriangle, color: "text-yellow-400" };
  return { label: "Down", icon: XCircle, color: "text-red-400" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function AdminStatusPage() {
  const [data, setData] = useState<AdminStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [globalDraft, setGlobalDraft] = useState("");
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savedGlobal, setSavedGlobal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/status");
      if (!res.ok) throw new Error("Failed");
      const json: AdminStatusResponse = await res.json();
      setData(json);
      setGlobalDraft(json.globalMessage ?? "");
      const drafts: Record<string, string> = {};
      json.services.forEach((s) => { drafts[s.id] = s.overrideMessage ?? ""; });
      setMessageDrafts(drafts);
    } catch {
      // leave data null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOverride = async (serviceId: string, value: string) => {
    const override = value === "auto" ? null : value;
    const overrideMessage = messageDrafts[serviceId]?.trim() || null;
    const res = await fetch("/api/admin/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "override", serviceId, override, overrideMessage }),
    });
    if (res.ok) await fetchData();
  };

  const handleSaveMessage = async (serviceId: string) => {
    const service = data?.services.find((s) => s.id === serviceId);
    if (!service) return;
    const overrideVal = service.override;
    const overrideMessage = messageDrafts[serviceId]?.trim() || null;
    const res = await fetch("/api/admin/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "override", serviceId, override: overrideVal, overrideMessage }),
    });
    if (res.ok) await fetchData();
  };

  const handleSubOverride = async (serviceId: string, subServiceId: string, value: string) => {
    const override = value === "auto" ? null : value;
    const res = await fetch("/api/admin/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subOverride", serviceId, subServiceId, override }),
    });
    if (res.ok) await fetchData();
  };

  const handleCheckAll = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkAll" }),
      });
      if (res.ok) {
        const json: AdminStatusResponse = await res.json();
        setData(json);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "globalMessage", message: globalDraft }),
      });
      if (res.ok) {
        setSavedGlobal(true);
        setTimeout(() => setSavedGlobal(false), 2000);
        await fetchData();
      }
    } finally {
      setSavingGlobal(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-6 py-10 text-center text-sm text-[var(--text-tertiary)]">
        Failed to load service status.
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Service Status</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Monitor and override service health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/status"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Globe className="h-3.5 w-3.5" />
            View Public Page
          </a>
          <button
            type="button"
            onClick={handleCheckAll}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--button-primary-text)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            Check All Now
          </button>
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-4">
        {data.services.map((service) => {
          const info = statusLabel(service.effectiveStatus);
          const Icon = info.icon;
          const autoInfo = statusLabel(service.status);
          const AutoIcon = autoInfo.icon;
          const currentOverride = service.override ?? "auto";

          return (
            <div
              key={service.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${info.color}`} />
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</h2>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                      <span>Effective: <strong className={info.color}>{info.label}</strong></span>
                      <span className="flex items-center gap-1">
                        <AutoIcon className="h-3 w-3" />
                        Auto: {autoInfo.label}
                      </span>
                      <span>Checked {timeAgo(service.lastChecked)}</span>
                      {service.lastChanged && <span>Changed {timeAgo(service.lastChanged)}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    Override
                  </label>
                  <DropdownSelect
                    options={OVERRIDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    value={currentOverride}
                    onChange={(val) => handleOverride(service.id, val)}
                    aria-label={`Override status for ${service.name}`}
                  />
                </div>

                <div className="flex-1 space-y-1" style={{ minWidth: 200 }}>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    Public Message
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageDrafts[service.id] ?? ""}
                      onChange={(e) =>
                        setMessageDrafts((d) => ({ ...d, [service.id]: e.target.value }))
                      }
                      placeholder="e.g. Scheduled maintenance until 5 PM"
                      className="flex-1 rounded-[var(--radius-md)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--input-text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveMessage(service.id)}
                      className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-tertiary)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      title="Save message"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-services */}
              {service.subServices && service.subServices.length > 0 && (
                <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-primary)]">
                  <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
                    Components
                  </p>
                  <div className="divide-y divide-[var(--border-default)]">
                    {service.subServices.map((sub) => {
                      const subInfo = statusLabel(sub.effectiveStatus);
                      const SubIcon = subInfo.icon;
                      const subOverrideVal = sub.override ?? "auto";
                      return (
                        <div key={sub.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <SubIcon className={`h-3.5 w-3.5 ${subInfo.color}`} />
                            <span className="text-xs text-[var(--text-primary)]">{sub.name}</span>
                          </div>
                          <DropdownSelect
                            options={OVERRIDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            value={subOverrideVal}
                            onChange={(val) => handleSubOverride(service.id, sub.id, val)}
                            aria-label={`Override status for ${sub.name}`}
                            className="text-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global message */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Global Status Message</h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
          Displayed at the top of the public status page regardless of service status.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={globalDraft}
            onChange={(e) => setGlobalDraft(e.target.value)}
            placeholder="e.g. Planned maintenance tonight 11 PM–1 AM EST"
            className="flex-1 rounded-[var(--radius-md)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--input-text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--button-primary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--button-primary-bg)]/30"
          />
          <button
            type="button"
            onClick={handleSaveGlobal}
            disabled={savingGlobal}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--button-primary-text)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savedGlobal ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {savedGlobal ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
