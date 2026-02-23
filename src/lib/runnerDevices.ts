export type RunnerDevice = {
  name: string;
  /** Xcode device identifier / UDID when available */
  id?: string;
  /** e.g. "ios", "tvos" */
  platform?: string;
  /** e.g. "17.3" */
  osVersion?: string;
  /** "physical" or "simulator" */
  kind: "physical" | "simulator";
};

export type RunnerDevicesSnapshot = {
  runnerId: string;
  updatedAt: number;
  physical: RunnerDevice[];
  simulators: RunnerDevice[];
};

// Use globalThis so the snapshot survives Next.js hot-reloads.
const g = globalThis as unknown as { __runnerDevices?: RunnerDevicesSnapshot };

export function setRunnerDevices(snapshot: RunnerDevicesSnapshot) {
  g.__runnerDevices = snapshot;
}

export function getRunnerDevices(): RunnerDevicesSnapshot | null {
  return g.__runnerDevices ?? null;
}

