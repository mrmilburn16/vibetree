import { describe, it, expect, beforeEach } from "vitest";
import { getAllDevices, removeDevice } from "@/lib/deviceStore";
import { getPushStatus } from "@/lib/apns";

const TEST_TOKEN = "test-device-token-for-register-test";

describe("Device registration and push status", () => {
  beforeEach(() => {
    removeDevice(TEST_TOKEN);
  });

  it("registering a device increases device count and push status sees it", async () => {
    const { POST } = await import("@/app/api/devices/register/route");
    const res = await POST(
      new Request("http://test/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceToken: TEST_TOKEN }),
      })
    );
    expect(res.status).toBe(200);

    const devices = getAllDevices();
    expect(devices.length).toBeGreaterThanOrEqual(1);
    expect(devices.some((d) => d.deviceToken === TEST_TOKEN)).toBe(true);

    const status = getPushStatus();
    expect(status.deviceCount).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/devices returns count after registration", async () => {
    const { POST } = await import("@/app/api/devices/register/route");
    const { GET } = await import("@/app/api/devices/route");

    await POST(
      new Request("http://test/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceToken: TEST_TOKEN }),
      })
    );

    const res = await GET(new Request("http://test/api/devices"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.message).toMatch(/registered/);
  });
});
