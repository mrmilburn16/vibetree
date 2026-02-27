/**
 * Simulator preview flow: Mac runner POSTs frames to /api/projects/[id]/simulator-frame;
 * PreviewPane polls GET /api/projects/[id]/simulator-preview. This test verifies the API
 * returns 404 when no frame, 200 + PNG when frame exists, and updatedAfter filtering.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getSimulatorFrame, setSimulatorFrame, clearSimulatorFrame } from "@/lib/simulatorFrameStore";

const PROJECT_ID = "proj_test_123";

describe("simulator preview", () => {
  beforeEach(() => {
    clearSimulatorFrame(PROJECT_ID);
  });

  it("getSimulatorFrame returns undefined when no frame was posted", () => {
    expect(getSimulatorFrame(PROJECT_ID)).toBeUndefined();
    expect(getSimulatorFrame("other_proj")).toBeUndefined();
  });

  it("setSimulatorFrame stores frame; getSimulatorFrame returns it with updatedAt", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const before = Date.now();
    setSimulatorFrame(PROJECT_ID, buf);
    const after = Date.now();
    const frame = getSimulatorFrame(PROJECT_ID);
    expect(frame).toBeDefined();
    expect(frame!.buffer).toEqual(buf);
    expect(frame!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(frame!.updatedAt).toBeLessThanOrEqual(after + 5);
  });

  it("GET simulator-preview returns 404 when no frame for project", async () => {
    const { GET } = await import("@/app/api/projects/[id]/simulator-preview/route");
    const res = await GET(
      new Request(`http://test/api/projects/${PROJECT_ID}/simulator-preview`),
      { params: Promise.resolve({ id: PROJECT_ID }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET simulator-preview returns 200 and PNG when frame exists", async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    setSimulatorFrame(PROJECT_ID, pngBytes);
    const { GET } = await import("@/app/api/projects/[id]/simulator-preview/route");
    const res = await GET(
      new Request(`http://test/api/projects/${PROJECT_ID}/simulator-preview`),
      { params: Promise.resolve({ id: PROJECT_ID }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(pngBytes.length);
  });

  it("GET simulator-preview with updatedAfter returns 404 when frame is older", async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    setSimulatorFrame(PROJECT_ID, pngBytes);
    const frame = getSimulatorFrame(PROJECT_ID)!;
    const updatedAfter = frame.updatedAt + 1000; // client went "live" 1s after frame
    const { GET } = await import("@/app/api/projects/[id]/simulator-preview/route");
    const res = await GET(
      new Request(`http://test/api/projects/${PROJECT_ID}/simulator-preview?updatedAfter=${updatedAfter}`),
      { params: Promise.resolve({ id: PROJECT_ID }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET simulator-preview with updatedAfter returns 200 when frame is newer", async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    setSimulatorFrame(PROJECT_ID, pngBytes);
    const frame = getSimulatorFrame(PROJECT_ID)!;
    const updatedAfter = frame.updatedAt - 1000; // client went "live" 1s before frame
    const { GET } = await import("@/app/api/projects/[id]/simulator-preview/route");
    const res = await GET(
      new Request(`http://test/api/projects/${PROJECT_ID}/simulator-preview?updatedAfter=${updatedAfter}`),
      { params: Promise.resolve({ id: PROJECT_ID }) }
    );
    expect(res.status).toBe(200);
  });
});
