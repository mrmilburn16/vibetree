import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const STATUS_PATH = join(process.cwd(), "data", "service-status.json");
const STALE_MS = 60_000;
const PING_TIMEOUT_MS = 5_000;
const DEGRADED_THRESHOLD_MS = 3_000;

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

const DEFAULT_SERVICES: ServiceEntry[] = [
  { id: "website", name: "Website", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "app-generation", name: "App Generation", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
  { id: "xcode-builds", name: "Xcode Builds", status: "operational", autoDetected: true, override: null, overrideMessage: null, lastChecked: null, lastChanged: null },
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
