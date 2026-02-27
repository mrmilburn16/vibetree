import { describe, it, expect, vi, beforeEach } from "vitest";

const getPushStatusMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apns", () => ({
  sendBuildNotification: vi.fn().mockResolvedValue({ sent: 1, failed: 0, reasons: [] }),
  getPushStatus: (...args: unknown[]) => getPushStatusMock(...args),
}));

const { POST } = await import("@/app/api/push/test/route");

describe("POST /api/push/test", () => {
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    getPushStatusMock.mockReturnValue({ configured: true, deviceCount: 1 });
  });

  it("returns 403 when not in development", async () => {
    process.env.NODE_ENV = "production";
    const res = await POST();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.message).toMatch(/development/);
    process.env.NODE_ENV = origNodeEnv;
  });

  it("returns 400 when APNs not configured (development)", async () => {
    process.env.NODE_ENV = "development";
    getPushStatusMock.mockReturnValue({ configured: false, deviceCount: 0 });
    const res = await POST();
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.message).toMatch(/APNs not configured|not configured/i);
    process.env.NODE_ENV = origNodeEnv;
  });

  it("returns 400 when no devices registered (development)", async () => {
    process.env.NODE_ENV = "development";
    getPushStatusMock.mockReturnValue({ configured: true, deviceCount: 0 });
    const res = await POST();
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.message).toMatch(/No devices registered|devices registered/i);
    process.env.NODE_ENV = origNodeEnv;
  });

  it("returns 200 and reports delivery when push succeeds (development)", async () => {
    process.env.NODE_ENV = "development";
    getPushStatusMock.mockReturnValue({ configured: true, deviceCount: 2 });
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message).toMatch(/delivered|device/);
    expect(data.deviceCount).toBe(2);
    expect(data.sent).toBe(1);
    process.env.NODE_ENV = origNodeEnv;
  });

  it("returns 200 with ok false when Apple rejects push (e.g. BadDeviceToken)", async () => {
    process.env.NODE_ENV = "development";
    getPushStatusMock.mockReturnValue({ configured: true, deviceCount: 1 });
    const apns = await import("@/lib/apns");
    vi.mocked(apns.sendBuildNotification).mockResolvedValueOnce({
      sent: 0,
      failed: 1,
      reasons: ["BadDeviceToken"],
    });
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.message).toMatch(/rejected|BadDeviceToken|Apple/);
    expect(data.reasons).toEqual(["BadDeviceToken"]);
    process.env.NODE_ENV = origNodeEnv;
  });
});
