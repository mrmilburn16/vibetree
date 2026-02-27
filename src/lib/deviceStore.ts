import * as fs from "fs";
import * as path from "path";

export interface RegisteredDevice {
  deviceToken: string;
  activityPushToken?: string;
  registeredAt: number;
}

const g = globalThis as unknown as { __registeredDevices?: Map<string, RegisteredDevice> };
if (!g.__registeredDevices) g.__registeredDevices = new Map();
const devices = g.__registeredDevices;

const DEVICES_FILE = path.join(process.cwd(), "data", "registered-devices.json");

function loadFromDisk(): void {
  try {
    const raw = fs.readFileSync(DEVICES_FILE, "utf8");
    const arr = JSON.parse(raw) as RegisteredDevice[];
    if (Array.isArray(arr)) {
      devices.clear();
      for (const d of arr) {
        if (d?.deviceToken) {
          devices.set(d.deviceToken, {
            deviceToken: d.deviceToken,
            activityPushToken: d.activityPushToken,
            registeredAt: d.registeredAt ?? Date.now(),
          });
        }
      }
    }
  } catch {
    // File missing or invalid — start empty
  }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(DEVICES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const arr = Array.from(devices.values());
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.warn("[deviceStore] Failed to save devices:", err);
  }
}

// Load persisted devices on first use (so they survive server restarts)
let loaded = false;
function ensureLoaded(): void {
  if (!loaded) {
    loaded = true;
    loadFromDisk();
  }
}

export function registerDevice(deviceToken: string, activityPushToken?: string): void {
  ensureLoaded();
  devices.set(deviceToken, {
    deviceToken,
    activityPushToken,
    registeredAt: Date.now(),
  });
  saveToDisk();
}

export function getAllDevices(): RegisteredDevice[] {
  ensureLoaded();
  return Array.from(devices.values());
}

export function removeDevice(deviceToken: string): void {
  ensureLoaded();
  devices.delete(deviceToken);
  saveToDisk();
}
