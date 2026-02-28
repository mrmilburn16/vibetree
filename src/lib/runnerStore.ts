/**
 * In-memory store for Mac runner heartbeat.
 * Used to detect runner availability before creating build jobs and to show UI status.
 */

const HEARTBEAT_STALE_MS = 60 * 1000; // 60 seconds
const STUCK_JOB_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export type RunnerState = {
  runnerId: string;
  lastSeen: number;
  status: string;
};

const g = globalThis as unknown as {
  __runnerState?: RunnerState;
  __lastStuckJobCheck?: number;
};
if (!g.__runnerState) g.__runnerState = { runnerId: "", lastSeen: 0, status: "" };

export function recordHeartbeat(runnerId: string, status: string): void {
  g.__runnerState = {
    runnerId,
    lastSeen: Date.now(),
    status,
  };
}

export function getRunnerState(): RunnerState {
  return g.__runnerState ?? { runnerId: "", lastSeen: 0, status: "" };
}

export function isRunnerOnline(): boolean {
  const state = getRunnerState();
  return state.lastSeen > 0 && Date.now() - state.lastSeen < HEARTBEAT_STALE_MS;
}

export function getRunnerStatus(): { online: boolean; lastSeen: number; runnerId: string } {
  const state = getRunnerState();
  const online = state.lastSeen > 0 && Date.now() - state.lastSeen < HEARTBEAT_STALE_MS;
  return {
    online,
    lastSeen: state.lastSeen,
    runnerId: state.runnerId || "",
  };
}

/** Returns true if we should run the stuck job check (throttled to every 2 min). */
export function shouldRunStuckJobCheck(): boolean {
  const now = Date.now();
  const last = g.__lastStuckJobCheck ?? 0;
  if (now - last >= STUCK_JOB_INTERVAL_MS) {
    g.__lastStuckJobCheck = now;
    return true;
  }
  return false;
}
