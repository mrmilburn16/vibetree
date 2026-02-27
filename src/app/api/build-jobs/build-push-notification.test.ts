/**
 * Ensures that when a build completes (from web or from iOS), the server sends a push
 * notification so the user is notified even if they left the app.
 *
 * - In app: you get a local notification (BuildMonitorService / ChatService).
 * - After leaving: Mac runner POSTs to /api/build-jobs/:id/update with status succeeded/failed,
 *   and the server calls sendBuildNotification (APNs) so the phone gets a push.
 * - Web build: same flow — job is run by mac-runner, which calls update → sendBuildNotification.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBuildJob } from "@/lib/buildJobs";
import { ensureProject } from "@/lib/projectStore";

const sendBuildNotification = vi.fn().mockResolvedValue(undefined);
const sendBackgroundRefreshPush = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/apns", () => ({
  sendBuildNotification,
  sendBackgroundRefreshPush,
}));

// Import after mock so the route uses mocked apns
const { POST } = await import("@/app/api/build-jobs/[id]/update/route");

const RUNNER_TOKEN = "test-runner-token";

describe("Build completion push notifications", () => {
  const projectId = "proj_push_test_123";
  const projectName = "Push Test App";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAC_RUNNER_TOKEN = RUNNER_TOKEN;
    ensureProject(projectId, projectName, "pro");
  });

  it("sends build success notification when job update has status succeeded", async () => {
    const job = createBuildJob({
      projectId,
      projectName,
      bundleId: "com.test.app",
    });

    const res = await POST(
      new Request("http://test/api/build-jobs/" + job.id, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNNER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "succeeded" }),
      }),
      { params: Promise.resolve({ id: job.id }) }
    );

    expect(res.status).toBe(200);
    expect(sendBackgroundRefreshPush).toHaveBeenCalledWith(`build_succeeded:${job.id}`);
    expect(sendBuildNotification).toHaveBeenCalledWith(projectName, "succeeded");
  });

  it("sends build failure notification when job update has status failed", async () => {
    const job = createBuildJob({
      projectId,
      projectName,
      bundleId: "com.test.app",
    });
    const errorDetail = "Compilation failed: missing symbol";

    const res = await POST(
      new Request("http://test/api/build-jobs/" + job.id, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNNER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "failed", error: errorDetail }),
      }),
      { params: Promise.resolve({ id: job.id }) }
    );

    expect(res.status).toBe(200);
    expect(sendBackgroundRefreshPush).toHaveBeenCalledWith(`build_failed:${job.id}`);
    expect(sendBuildNotification).toHaveBeenCalledWith(
      projectName,
      "failed",
      errorDetail
    );
  });

  it("does not send notification when status is only running", async () => {
    const job = createBuildJob({
      projectId,
      projectName,
      bundleId: "com.test.app",
    });

    await POST(
      new Request("http://test/api/build-jobs/" + job.id, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNNER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "running" }),
      }),
      { params: Promise.resolve({ id: job.id }) }
    );

    expect(sendBuildNotification).not.toHaveBeenCalled();
  });
});
