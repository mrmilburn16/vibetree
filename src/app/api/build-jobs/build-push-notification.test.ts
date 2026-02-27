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
import * as fs from "fs";
import * as path from "path";
import { createBuildJob } from "@/lib/buildJobs";
import { ensureProject, updateProject } from "@/lib/projectStore";

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

  it("awaits push before responding so notification is sent instantly when build succeeds", async () => {
    const job = createBuildJob({
      projectId,
      projectName,
      bundleId: "com.test.app",
    });
    let resolvePush: () => void;
    const pushPromise = new Promise<void>((r) => {
      resolvePush = r;
    });
    sendBackgroundRefreshPush.mockResolvedValueOnce(undefined);
    sendBuildNotification.mockReturnValueOnce(pushPromise);

    const responsePromise = POST(
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

    await new Promise((r) => setTimeout(r, 20));
    expect(sendBuildNotification).toHaveBeenCalledWith(projectName, "succeeded");
    let responded = false;
    responsePromise.then(() => {
      responded = true;
    });
    await new Promise((r) => setImmediate(r));
    expect(responded).toBe(false);
    resolvePush!();
    const res = await responsePromise;
    expect(res.status).toBe(200);
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

  it("web build completion: validate-xcode creates job, runner update with succeeded triggers push", async () => {
    const { POST: validatePost } = await import("@/app/api/projects/[id]/validate-xcode/route");
    const validateRes = await validatePost(
      new Request("http://test/validate-xcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          bundleId: "com.test.app",
        }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(validateRes.ok).toBe(true);
    const validateData = await validateRes.json().catch(() => ({}));
    const jobId = validateData?.job?.id;
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe("string");

    const updateRes = await POST(
      new Request("http://test/api/build-jobs/" + jobId, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNNER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "succeeded" }),
      }),
      { params: Promise.resolve({ id: jobId }) }
    );
    expect(updateRes.status).toBe(200);
    expect(sendBuildNotification).toHaveBeenCalledWith(projectName, "succeeded");
  });
});

describe("Web build success triggers iOS push (full chain)", () => {
  const macRunnerPath = path.resolve(process.cwd(), "scripts/mac-runner.mjs");
  const updateRoutePath = path.resolve(process.cwd(), "src/app/api/build-jobs/[id]/update/route.ts");

  it("mac-runner calls updateJob with status succeeded on build success so server can send push", () => {
    const content = fs.readFileSync(macRunnerPath, "utf8");
    expect(content).toMatch(/updateJob\s*\([^)]+,\s*\{\s*status:\s*["']succeeded["']/);
    expect(content).toMatch(/status:\s*["']succeeded["'].*exitCode:\s*0/);
  });

  it("update route calls sendBuildNotification when status is succeeded so iOS gets push", () => {
    const content = fs.readFileSync(updateRoutePath, "utf8");
    expect(content).toContain("sendBuildNotification");
    expect(content).toMatch(/freshJob\.status\s*===\s*["']succeeded["']/);
    expect(content).toMatch(/sendBuildNotification\s*\(\s*displayName\s*,\s*["']succeeded["']\s*\)/);
  });
});

describe("Push notification uses current project title (not Untitled app)", () => {
  const projectId = "proj_title_test_456";
  const RUNNER_TOKEN = "test-runner-token";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAC_RUNNER_TOKEN = RUNNER_TOKEN;
  });

  it("when project name is updated via PATCH before build completes, push uses updated title", async () => {
    ensureProject(projectId, "Untitled app", "pro");
    const job = createBuildJob({
      projectId,
      projectName: "Untitled app",
      bundleId: "com.test.app",
    });
    updateProject(projectId, { name: "My Cool App" });

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
    expect(sendBuildNotification).toHaveBeenCalledWith("My Cool App", "succeeded");
    expect(sendBuildNotification).not.toHaveBeenCalledWith("Untitled app", expect.anything());
  });
});
