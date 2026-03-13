#!/usr/bin/env npx tsx
/**
 * End-to-end integration test for the admin build cache.
 *
 * PREREQUISITES:
 *   1. Dev server running:  npm run dev
 *   2. Mac runner running:  npm run mac-runner
 *   3. USER_SESSION env var — your vibetree-session cookie value (see below)
 *
 * HOW TO GET YOUR SESSION COOKIE:
 *   a. Open http://localhost:3001 in your browser and sign in.
 *   b. Open DevTools → Application → Cookies → http://localhost:3001
 *   c. Copy the value of the "vibetree-session" cookie.
 *   d. Pass it as USER_SESSION when running the script.
 *
 * Usage:
 *   USER_SESSION=<your-cookie-value> npx tsx scripts/test-build-cache-e2e.ts
 *   USER_SESSION=<val> BASE_URL=http://localhost:3001 npx tsx scripts/test-build-cache-e2e.ts
 *   USER_SESSION=<val> BASE_URL=https://prod ADMIN_SECRET=secret npx tsx scripts/test-build-cache-e2e.ts
 *
 * Why is USER_SESSION needed?
 *   Project creation and code generation (/api/projects, /api/projects/:id/message/stream,
 *   /api/projects/:id/validate-xcode) all require a verified Firebase user session.
 *   The admin bypass only covers /api/admin/* routes.
 *
 * Flow:
 *   1. DELETE /api/admin/build-cache       — start from a clean cache
 *   2. Fresh build  — full pipeline: create project → stream code gen → Xcode build → store in cache
 *   3. Cached build — same prompt: cache hit → skip pipeline entirely
 *   4. Assertions   — fresh > 30s, cached < 2s, both results match
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dev-secret-change-me";
const USER_SESSION = process.env.USER_SESSION ?? "";

// A short, guaranteed-to-compile SwiftUI prompt.
const PROMPT =
  "Create a simple counter app with a plus button, minus button, and a number display in the center.";
const PROJECT_NAME = "SimpleCounterApp";
const BUNDLE_ID = "com.vibetree.e2etest";
const MODEL = "sonnet-4.6";

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

/** djb2-style hash — matches hashString() in src/lib/proxyCache.ts */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

const EXPECTED_HASH = hashString(PROMPT.trim().toLowerCase());

// ─── Console helpers ──────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(msg);
}
function dim(msg: string): void {
  console.log(`\x1b[2m${msg}\x1b[0m`);
}
function step(n: number, title: string): void {
  console.log(`\n\x1b[1mStep ${n} — ${title}\x1b[0m`);
}
function ok(label: string, detail?: string): void {
  const d = detail ? `  \x1b[2m(${detail})\x1b[0m` : "";
  console.log(`  \x1b[32m✓\x1b[0m  ${label}${d}`);
}
function fail(label: string, detail?: string): void {
  const d = detail ? `  \x1b[2m(${detail})\x1b[0m` : "";
  console.log(`  \x1b[31m✗\x1b[0m  ${label}${d}`);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function tryLogin(): Promise<string | undefined> {
  try {
    const res = await fetch(`${BASE}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: ADMIN_SECRET }),
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    const match = cookie.match(/vibetree_admin_session=([^;]+)/);
    if (res.ok && match) return `vibetree_admin_session=${match[1]}`;
  } catch { /* ignore */ }
  return undefined;
}

// ─── NDJSON stream reader ─────────────────────────────────────────────────────
// Ported directly from readNDJSONStream() in src/app/admin/test-suite/page.tsx

async function readNDJSONStream(
  res: Response,
  onEvent?: (ev: Record<string, unknown>) => void,
): Promise<{ done: Record<string, unknown> | null }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body to read");
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: Record<string, unknown> | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;
          onEvent?.(obj);
          if (obj["type"] === "done") donePayload = obj;
          if (obj["type"] === "error") throw new Error(String(obj["error"] ?? "Stream error"));
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer) as Record<string, unknown>;
        onEvent?.(obj);
        if (obj["type"] === "done") donePayload = obj;
      } catch { /* partial final line */ }
    }
  } finally {
    try { reader.cancel(); } catch { /* ignore */ }
  }
  return { done: donePayload };
}

// ─── Build job poller ─────────────────────────────────────────────────────────
// Ported from pollBuildJob() in src/app/admin/test-suite/page.tsx

type BuildJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  compilerErrors?: string[];
  logs?: string[];
  nextJobId?: string;
  autoFixInProgress?: boolean;
  request?: { files?: Array<{ path: string; content: string }> };
};

async function pollBuildJob(
  baseUrl: string,
  jobId: string,
  headers: Record<string, string>,
  onStatus?: (status: string, attempt: number) => void,
): Promise<{ finalJob: BuildJob; attempts: number }> {
  const POLL_INTERVAL = 3_000;
  const MAX_POLL_TIME = 20 * 60 * 1_000;
  const MAX_QUEUED_TIME = 2 * 60 * 1_000;
  const start = Date.now();
  let attempts = 1;
  let currentId = jobId;
  let queuedSince = Date.now();
  let wasEverPickedUp = false;
  let lastStatus = "";

  while (Date.now() - start < MAX_POLL_TIME) {
    const res = await fetch(`${baseUrl}/api/build-jobs/${currentId}`, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Build job ${currentId} not found (404) — the server may have restarted.`);
      }
      throw new Error(`Poll failed: ${res.status}`);
    }
    const data = (await res.json()) as { job: BuildJob };
    const job = data.job;

    if (job.status === "queued" && !wasEverPickedUp) {
      if (Date.now() - queuedSince > MAX_QUEUED_TIME) {
        throw new Error(
          "Build job stuck in queue for 2 min — is the Mac runner running?\n" +
            "  Start it with: npm run mac-runner",
        );
      }
    } else {
      wasEverPickedUp = true;
    }

    const label = attempts > 1 ? `auto-fix attempt ${attempts}` : job.status;
    if (label !== lastStatus) {
      onStatus?.(label, attempts);
      lastStatus = label;
    }

    if (job.status === "succeeded") return { finalJob: job, attempts };

    if (job.status === "failed") {
      if (job.nextJobId) {
        currentId = job.nextJobId;
        attempts++;
        queuedSince = Date.now();
        wasEverPickedUp = false;
        continue;
      }
      if (job.autoFixInProgress) {
        await sleep(POLL_INTERVAL);
        continue;
      }
      return { finalJob: job, attempts };
    }

    await sleep(POLL_INTERVAL);
  }
  throw new Error("Build job timed out after 20 minutes");
}

// ─── Full build pipeline (mirrors runSingleTest steps 1-4) ───────────────────

type PipelineResult = {
  compiled: boolean;
  attempts: number;
  compilerErrors: string[];
  fileCount: number;
  fileNames: string[];
  projectFiles: Array<{ path: string; content: string }>;
  skillsUsed: string[];
  projectId: string;
  wallMs: number;
};

async function runFreshBuild(headers: Record<string, string>): Promise<PipelineResult> {
  const t0 = Date.now();

  // Step 1 of pipeline — create project
  dim("  → POST /api/projects");
  const projRes = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `[E2E Cache Test] ${PROJECT_NAME}` }),
  });
  if (!projRes.ok) throw new Error(`Create project failed: ${projRes.status}`);
  const projData = (await projRes.json()) as { project?: { id: string }; id?: string };
  const projectId = projData.project?.id ?? projData.id;
  if (!projectId) throw new Error("No project id in response");
  dim(`  → project id: ${projectId}`);

  // Step 2 of pipeline — generate Swift via Claude (NDJSON stream)
  dim(`  → POST /api/projects/${projectId}/message/stream`);
  const streamRes = await fetch(`${BASE}/api/projects/${projectId}/message/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: PROMPT, projectType: "pro", model: MODEL }),
  });
  if (!streamRes.ok) throw new Error(`Stream failed: ${streamRes.status}`);

  let fileCount = 0;
  const { done } = await readNDJSONStream(streamRes, (ev) => {
    if (ev["type"] === "file") {
      fileCount = (ev["count"] as number) ?? fileCount + 1;
      dim(`  → generated file ${fileCount}: ${String(ev["path"] ?? "").split("/").pop()}`);
    }
  });
  if (!done) throw new Error("No 'done' event received from stream");

  const projectFiles = (
    done["projectFiles"] as Array<{ path: string; content: string }> | undefined
  ) ?? [];
  const skillsUsed = Array.isArray(done["skillIds"]) ? (done["skillIds"] as string[]) : [];
  fileCount = projectFiles.length || fileCount;
  dim(`  → generation complete: ${fileCount} files, skills: [${skillsUsed.join(", ") || "none"}]`);

  if (!projectFiles.length) throw new Error("No files generated — cannot submit build");

  // Step 3 of pipeline — submit to Xcode via Mac runner
  dim(`  → POST /api/projects/${projectId}/validate-xcode`);
  const buildRes = await fetch(`${BASE}/api/projects/${projectId}/validate-xcode`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      files: projectFiles,
      projectName: PROJECT_NAME,
      bundleId: BUNDLE_ID,
      autoFix: true,
      maxAttempts: 3,
      developmentTeam: undefined,
    }),
  });
  const buildData = (await buildRes.json()) as {
    job?: { id: string };
    error?: string;
    message?: string;
  };
  if (buildData.error === "mac_runner_offline") {
    throw new Error(
      "Mac runner is offline — start it first:\n  npm run mac-runner",
    );
  }
  if (!buildData.job?.id) throw new Error(`No build job created: ${JSON.stringify(buildData)}`);
  dim(`  → build job id: ${buildData.job.id}`);

  // Step 4 of pipeline — poll until the build finishes
  const { finalJob, attempts } = await pollBuildJob(
    BASE,
    buildData.job.id,
    headers,
    (status, att) => dim(`  → build status: ${status}${att > 1 ? ` (attempt ${att})` : ""}`),
  );

  const compiled = finalJob.status === "succeeded";
  const compilerErrors = (finalJob.compilerErrors as string[]) ?? [];
  const builtFiles =
    compiled && finalJob.request?.files?.length ? finalJob.request.files : projectFiles;

  return {
    compiled,
    attempts,
    compilerErrors,
    fileCount: builtFiles.length,
    fileNames: builtFiles.map((f) => f.path),
    projectFiles: builtFiles,
    skillsUsed,
    projectId,
    wallMs: Date.now() - t0,
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function storeInCache(
  headers: Record<string, string>,
  pipeline: PipelineResult,
  durationMs: number,
): Promise<string> {
  const filesRecord: Record<string, string> = {};
  for (const f of pipeline.projectFiles) filesRecord[f.path] = f.content;
  const res = await fetch(`${BASE}/api/admin/build-cache`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: PROMPT,
      result: {
        projectId: pipeline.projectId,
        projectName: PROJECT_NAME,
        prompt: PROMPT,
        tier: "easy",
        category: "e2e-test",
        compiled: pipeline.compiled,
        attempts: pipeline.attempts,
        autoFixUsed: pipeline.attempts > 1,
        compilerErrors: pipeline.compilerErrors,
        fileCount: pipeline.fileCount,
        fileNames: pipeline.fileNames,
        durationMs,
        skillsUsed: pipeline.skillsUsed,
      },
      projectFiles: filesRecord,
    }),
  });
  if (!res.ok) throw new Error(`Cache store failed: ${res.status}`);
  const data = (await res.json()) as { promptHash?: string };
  return data.promptHash ?? EXPECTED_HASH;
}

type CachedEntry = {
  result: { compiled: boolean; attempts: number; fileCount: number };
  projectFiles: Record<string, string>;
};

async function checkCache(
  headers: Record<string, string>,
  promptHash: string,
): Promise<CachedEntry | null> {
  const res = await fetch(`${BASE}/api/admin/build-cache?promptHash=${promptHash}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cache check failed: ${res.status}`);
  const data = (await res.json()) as { cached: CachedEntry | null };
  return data.cached;
}

// ─── Assertions ───────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    ok(label, detail);
    passCount++;
  } else {
    fail(label, detail);
    failCount++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("\x1b[1m\nBuild Cache — End-to-End Integration Test\x1b[0m");
  log(`Target  : ${BASE}`);
  log(`Prompt  : "${PROMPT}"`);
  log(`Hash    : ${EXPECTED_HASH}`);

  // Verify server is reachable before wasting time
  try {
    const ping = await fetch(`${BASE}/api/status`);
    if (!ping.ok) throw new Error(`/api/status returned ${ping.status}`);
    dim("Server reachable ✓");
  } catch (e) {
    console.error(`\x1b[31mERROR: Cannot reach ${BASE} — is the dev server running?\x1b[0m`);
    console.error(e);
    process.exit(1);
  }

  // Check USER_SESSION before doing anything
  if (!USER_SESSION) {
    console.error(
      "\x1b[31mERROR: USER_SESSION is required.\x1b[0m\n\n" +
        "Project routes (/api/projects, /api/projects/:id/message/stream, validate-xcode)\n" +
        "all require a verified Firebase user session. The admin bypass only covers /api/admin/*.\n\n" +
        "How to get your session cookie:\n" +
        "  1. Open http://localhost:3001 in your browser and sign in\n" +
        "  2. DevTools → Application → Cookies → http://localhost:3001\n" +
        "  3. Copy the value of the 'vibetree-session' cookie\n" +
        "  4. Re-run: USER_SESSION=<paste-here> npx tsx scripts/test-build-cache-e2e.ts\n",
    );
    process.exit(1);
  }

  // Admin session (dev bypass handles this transparently in local dev)
  const adminCookie = await tryLogin();
  const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };

  // Build a combined Cookie header: admin session + user Firebase session
  const cookieParts: string[] = [`vibetree-session=${USER_SESSION}`];
  if (adminCookie) cookieParts.push(adminCookie);
  baseHeaders["Cookie"] = cookieParts.join("; ");

  if (adminCookie) {
    dim("Auth: admin cookie set + vibetree-session forwarded");
  } else {
    dim("Auth: vibetree-session forwarded (admin bypass active in dev)");
  }

  // ── Step 1: Clear cache ─────────────────────────────────────────────────────
  step(1, "Clear build cache");
  const delRes = await fetch(`${BASE}/api/admin/build-cache`, { method: "DELETE", headers: baseHeaders });
  assert("DELETE returns 200", delRes.status === 200, `status ${delRes.status}`);
  const delJson = (await delRes.json()) as { ok?: boolean };
  assert("ok: true in body", delJson.ok === true);

  // Confirm the cache is empty for our prompt
  const preCheck = await checkCache(baseHeaders, EXPECTED_HASH);
  assert("Cache is empty before fresh build", preCheck === null);

  // ── Step 2: Fresh build (full pipeline) ─────────────────────────────────────
  step(2, "Fresh build  (Claude codegen → Xcode compile)");
  log(
    "  \x1b[33mThis will take 1–5 minutes. Please wait…\x1b[0m\n" +
      "  (Mac runner must be running. Kill with Ctrl+C if runner is down.)",
  );
  const freshT0 = Date.now();
  let pipeline: PipelineResult;
  try {
    pipeline = await runFreshBuild(baseHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n\x1b[31mFresh build FAILED:\x1b[0m ${msg}`);
    process.exit(1);
  }
  const freshMs = Date.now() - freshT0;

  log(`\n  Fresh build completed in \x1b[1m${formatMs(freshMs)}\x1b[0m`);
  assert("Fresh build compiled", pipeline.compiled, pipeline.compiled ? "compiled: true" : `errors: ${pipeline.compilerErrors.slice(0, 2).join("; ")}`);
  assert("Fresh build took > 30 seconds", freshMs > 30_000, formatMs(freshMs));
  assert("Generated at least 1 Swift file", pipeline.fileCount >= 1, `${pipeline.fileCount} files`);

  // Store result in cache
  dim("  → storing result in build cache");
  const storedHash = await storeInCache(baseHeaders, pipeline, freshMs);
  assert(`Cache stored with hash ${storedHash}`, storedHash === EXPECTED_HASH, `stored hash: ${storedHash}`);

  // Verify it's now retrievable
  const postFreshCache = await checkCache(baseHeaders, EXPECTED_HASH);
  assert("Cache entry is now retrievable", postFreshCache !== null);
  assert(
    "Cached entry has correct compiled flag",
    postFreshCache?.result.compiled === pipeline.compiled,
  );

  // ── Step 3: Cached build (same prompt, cache hit) ───────────────────────────
  step(3, "Cached build  (same prompt — should skip pipeline entirely)");
  const cachedT0 = Date.now();
  const hit = await checkCache(baseHeaders, EXPECTED_HASH);
  const cachedMs = Date.now() - cachedT0;

  log(`  Cache lookup completed in \x1b[1m${formatMs(cachedMs)}\x1b[0m`);
  assert("Cache returns a hit for same prompt", hit !== null);
  assert("Cached build took < 2 seconds", cachedMs < 2_000, formatMs(cachedMs));
  assert(
    "Cached result compiled flag matches fresh build",
    hit?.result.compiled === pipeline.compiled,
    `fresh=${String(pipeline.compiled)}, cached=${String(hit?.result.compiled)}`,
  );
  assert(
    "Cached fileCount matches fresh build",
    hit?.result.fileCount === pipeline.fileCount,
    `fresh=${pipeline.fileCount}, cached=${hit?.result.fileCount}`,
  );
  assert(
    "Cached projectFiles is non-empty",
    Object.keys(hit?.projectFiles ?? {}).length > 0,
    `${Object.keys(hit?.projectFiles ?? {}).length} files`,
  );

  // ── Step 4: Speed comparison summary ────────────────────────────────────────
  const speedup = freshMs / Math.max(cachedMs, 1);
  log(`\n${"─".repeat(55)}`);
  log(`\x1b[1mPerformance comparison:\x1b[0m`);
  log(`  Fresh build  : \x1b[33m${formatMs(freshMs)}\x1b[0m  (Claude + Xcode)`);
  log(`  Cached build : \x1b[32m${formatMs(cachedMs)}\x1b[0m  (in-memory lookup)`);
  log(`  Speedup      : \x1b[1m${speedup.toFixed(0)}×\x1b[0m faster`);

  // ── Final assertions & summary ───────────────────────────────────────────────
  log(`\n${"─".repeat(55)}`);
  const total = passCount + failCount;
  if (failCount === 0) {
    log(`\x1b[32m✓ All ${total} checks passed.\x1b[0m`);
    log(`  Build cache is working correctly end-to-end.\n`);
  } else {
    log(`\x1b[31m✗ ${failCount}/${total} checks FAILED.\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mUnhandled error:\x1b[0m", e);
  process.exit(1);
});
