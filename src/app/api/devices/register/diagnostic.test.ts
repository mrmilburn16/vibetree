/**
 * Diagnostic: verifies the server-side device registration and push flow.
 * Run with: npm test -- --run src/app/api/devices/register/diagnostic.test.ts
 *
 * Findings when run against live server (curl):
 * - POST /api/devices/register with a token → 200, count becomes 1 ✓
 * - POST /api/push/test with that token → Apple returns BadDeviceToken (fake token), we remove it, count back to 0 ✓
 * So "No devices registered" means either:
 * 1. The iPhone never successfully POSTs to /api/devices/register (wrong Server URL, network, or app not getting token).
 * 2. The iPhone did register but the token was invalid (BadDeviceToken); we removed it, so count is 0 again.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getAllDevices, removeDevice } from "@/lib/deviceStore";
import { getPushStatus } from "@/lib/apns";

const DIAG_TOKEN = "diagnostic-fake-token-not-real-apns";

describe("Device registration diagnostic", () => {
  beforeEach(() => {
    removeDevice(DIAG_TOKEN);
  });

  it("register route accepts POST and increases device count", async () => {
    const { POST } = await import("@/app/api/devices/register/route");
    const res = await POST(
      new Request("http://test/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceToken: DIAG_TOKEN }),
      })
    );
    expect(res.status).toBe(200);
    const devices = getAllDevices();
    expect(devices.some((d) => d.deviceToken === DIAG_TOKEN)).toBe(true);
  });

  it("getPushStatus sees registered devices", async () => {
    const { POST } = await import("@/app/api/devices/register/route");
    await POST(
      new Request("http://test/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceToken: DIAG_TOKEN }),
      })
    );
    const status = getPushStatus();
    expect(status.deviceCount).toBeGreaterThanOrEqual(1);
  });
});
