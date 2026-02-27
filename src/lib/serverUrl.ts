import os from "os";

/**
 * Best-effort URL this server is reachable at on the local network (for Companion app Server URL hint).
 * Uses first non-internal IPv4. Returns null if not determinable (e.g. serverless).
 */
export function getSuggestedServerURL(): string | null {
  const port = process.env.PORT ?? "3001";
  try {
    const ifaces = os.networkInterfaces();
    for (const list of Object.values(ifaces)) {
      if (!list) continue;
      for (const iface of list) {
        if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal && iface.address) {
          return `http://${iface.address}:${port}`;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}
