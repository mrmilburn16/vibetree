import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const STATUS_PATH = join(process.cwd(), "data", "service-status.json");
const UPTIME_LOG_PATH = join(process.cwd(), "data", "uptime-history.jsonl");
const STALE_MS = 60_000;
const PING_TIMEOUT_MS = 5_000;
const DEGRADED_THRESHOLD_MS = 3_000;
const UPTIME_DAYS = 90;

export type ServiceStatusValue = "operational" | "degraded" | "down";

export interface ServiceEntry {
  id: string;
  name: string;
  status: ServiceStatusValue;
  autoDetected: boolean;
  override: ServiceStatusValue | null;
  overrideMessage: string | null;
  lastChecked: string | null;
  lastChanged: string | null;
}

export interface StatusData {
  services: ServiceEntry[];
  globalMessage: string | null;
}

export interface UptimeCheckEntry {
  ts: string;
  serviceId: string;
  status: ServiceStatusValue;
}

export interface DayBucket {
  date: string;
  status: ServiceStatusValue;
  checks: number;
  operational: number;
  degraded: number;
  down: number;
}

export interface ServiceUptimeHistory {
  serviceId: string;
  uptimePct: number;
  days: DayBucket[];
}

const DEFAULT_SERVICES: ServiceEntry[] = [
  { id: "website", name: "Website", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "app-generation", name: "App Generation", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "xcode-builds", name: "Xcode Builds", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "cloud-services", name: "Cloud Services", status: "operational", autoDetected: false, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "push-notifications", name: "Push Notifications", status: "operational", autoDetected: false, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "authentication", name: "Authentication", status: "operational", autoDetected: false, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
];

function ensureFile() {
  if (!existsSync(STATUS_PATH)) {
    const dir = dirname(STATUS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const initial: StatusData = { services: DEFAULT_SERVICES, globalMessage: null };
    writeFileSync(STATUS_PATH, JSON.stringify(initial, null, 2) + "\n", "utf8");
  }
}

export function loadStatus(): StatusData {
  ensureFile();
  try {
    const data = JSON.parse(readFileSync(STATUS_PATH, "utf8")) as StatusData;
    for (const def of DEFAULT_SERVICES) {
      if (!data.services.find((s) => s.id === def.id)) {
        data.services.push({ ...def });
      }
    }
    return data;
  } catch {
    return { services: [...DEFAULT_SERVICES], globalMessage: null };
  }
}

export function saveStatus(data: StatusData): void {
  ensureFile();
  writeFileSync(STATUS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function getEffectiveStatus(service: ServiceEntry): ServiceStatusValue {
  return service.override ?? service.status;
}

function isStale(data: StatusData): boolean {
  const checked = data.services
    .map((s) => s.lastChecked)
    .filter(Boolean) as string[];
  if (checked.length === 0) return true;
  const latest = Math.max(...checked.map((d) => new Date(d).getTime()));
  return Date.now() - latest > STALE_MS;
}

async function pingEndpoint(url: string, method = "GET"): Promise<ServiceStatusValue> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { "X-Health-Check": "1" },
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    if (res.status >= 500) return "down";
    if (elapsed > DEGRADED_THRESHOLD_MS) return "degraded";
    return "operational";
  } catch {
    clearTimeout(timeout);
    return "down";
  }
}

const SERVICE_ENDPOINTS: Record<string, { path: string; method?: string }> = {
  website: { path: "/" },
  "app-generation": { path: "/api/projects" },
  "xcode-builds": { path: "/api/build-jobs/claim", method: "POST" },
};

export async function runHealthChecks(baseUrl: string): Promise<StatusData> {
  const data = loadStatus();
  const now = new Date().toISOString();

  for (const service of data.services) {
    const endpoint = SERVICE_ENDPOINTS[service.id];
    if (!endpoint) continue;

    const url = `${baseUrl}${endpoint.path}`;
    const newStatus = await pingEndpoint(url, endpoint.method);
    const oldEffective = getEffectiveStatus(service);

    service.status = newStatus;
    service.autoDetected = true;
    service.lastChecked = now;

    const newEffective = getEffectiveStatus(service);
    if (newEffective !== oldEffective) {
      service.lastChanged = now;
    }

    logUptimeCheck(service.id, newEffective);
  }

  saveStatus(data);
  return data;
}

export async function runHealthChecksIfStale(baseUrl: string): Promise<StatusData> {
  const data = loadStatus();
  if (!isStale(data)) return data;
  return runHealthChecks(baseUrl);
}

export function setServiceOverride(
  serviceId: string,
  override: ServiceStatusValue | null,
  overrideMessage: string | null,
): ServiceEntry | null {
  const data = loadStatus();
  const service = data.services.find((s) => s.id === serviceId);
  if (!service) return null;

  const oldEffective = getEffectiveStatus(service);
  service.override = override;
  service.overrideMessage = overrideMessage;
  const newEffective = getEffectiveStatus(service);

  if (newEffective !== oldEffective) {
    service.lastChanged = new Date().toISOString();
  }

  saveStatus(data);
  return service;
}

export function setGlobalMessage(message: string | null): void {
  const data = loadStatus();
  data.globalMessage = message;
  saveStatus(data);
}

function logUptimeCheck(serviceId: string, status: ServiceStatusValue): void {
  const entry: UptimeCheckEntry = {
    ts: new Date().toISOString(),
    serviceId,
    status,
  };
  const dir = dirname(UPTIME_LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(UPTIME_LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getUptimeHistory(): ServiceUptimeHistory[] {
  const entries: UptimeCheckEntry[] = [];
  if (existsSync(UPTIME_LOG_PATH)) {
    try {
      const raw = readFileSync(UPTIME_LOG_PATH, "utf8");
      for (const line of raw.split(/\r?\n/).filter(Boolean)) {
        try {
          entries.push(JSON.parse(line));
        } catch { /* skip bad lines */ }
      }
    } catch { /* no file yet */ }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UPTIME_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffKey = dateKey(cutoff);

  const filtered = entries.filter((e) => e.ts.slice(0, 10) >= cutoffKey);

  const serviceIds = ["website", "app-generation", "xcode-builds", "cloud-services", "push-notifications", "authentication"];
  const results: ServiceUptimeHistory[] = [];

  for (const sid of serviceIds) {
    const mine = filtered.filter((e) => e.serviceId === sid);

    const byDay = new Map<string, { operational: number; degraded: number; down: number }>();
    for (const e of mine) {
      const dk = e.ts.slice(0, 10);
      const cur = byDay.get(dk) ?? { operational: 0, degraded: 0, down: 0 };
      cur[e.status] += 1;
      byDay.set(dk, cur);
    }

    const days: DayBucket[] = [];
    const cursor = new Date(cutoff);
    const today = dateKey(new Date());
    while (dateKey(cursor) <= today) {
      const dk = dateKey(cursor);
      const counts = byDay.get(dk);
      const total = counts ? counts.operational + counts.degraded + counts.down : 0;

      let dayStatus: ServiceStatusValue = "operational";
      if (counts) {
        if (counts.down > 0) dayStatus = counts.down > total / 2 ? "down" : "degraded";
        else if (counts.degraded > 0) dayStatus = "degraded";
      }

      days.push({
        date: dk,
        status: total === 0 ? "operational" : dayStatus,
        checks: total,
        operational: counts?.operational ?? 0,
        degraded: counts?.degraded ?? 0,
        down: counts?.down ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const totalChecks = mine.length;
    const opChecks = mine.filter((e) => e.status === "operational").length;
    const uptimePct = totalChecks > 0 ? (opChecks / totalChecks) * 100 : 100;

    results.push({ serviceId: sid, uptimePct, days });
  }

  return results;
}

export function getServiceAlerts(): Array<{ id: string; type: string; title: string; message: string }> {
  const data = loadStatus();
  const alerts: Array<{ id: string; type: string; title: string; message: string }> = [];

  for (const service of data.services) {
    const effective = getEffectiveStatus(service);
    if (effective === "down") {
      const when = service.lastChanged
        ? new Date(service.lastChanged).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })
        : "Unknown time";
      alerts.push({
        id: `status-${service.id}`,
        type: "error",
        title: `Service Down: ${service.name}`,
        message: `Detected at ${when}. Go to Status page to manage.`,
      });
    } else if (effective === "degraded") {
      alerts.push({
        id: `status-${service.id}`,
        type: "warning",
        title: `Service Degraded: ${service.name}`,
        message: `${service.name} is responding slowly. Check Status page for details.`,
      });
    }
  }

  return alerts;
}
