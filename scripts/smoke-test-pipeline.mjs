#!/usr/bin/env node
/**
 * Smoke test: run one app (Smoke Test) through the full pipeline and verify
 * that project files are present after build so Run on iPhone and Xcode download work.
 * Usage: BASE_URL=http://localhost:3001 node scripts/smoke-test-pipeline.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3001";
const SMOKE_PROMPT =
  "Build the simplest possible iOS app. Just a white screen with a label in the center that says Hello Vibetree in large bold text. Nothing else.";

async function main() {
  console.log("1. Creating project...");
  const projectRes = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "[Smoke] Smoke Test" }),
  });
  if (!projectRes.ok) {
    throw new Error(`Create project failed: ${projectRes.status}`);
  }
  const data = await projectRes.json();
  const projectId = data.project?.id ?? data.id;
  if (!projectId) throw new Error("No project id in response");
  console.log("   Project ID:", projectId);

  console.log("2. Sending message stream (generation)...");
  const streamRes = await fetch(`${BASE}/api/projects/${projectId}/message/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: SMOKE_PROMPT,
      projectType: "pro",
      model: "sonnet-4.6",
    }),
  });
  if (!streamRes.ok) {
    throw new Error(`Stream failed: ${streamRes.status}`);
  }

  let done = null;
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === "done") done = obj;
      } catch (_) {}
    }
  }
  if (!done) throw new Error("No 'done' event in stream");

  console.log("3. Fetching project files (GET /api/projects/:id/files)...");
  const filesRes = await fetch(`${BASE}/api/projects/${projectId}/files`);
  if (!filesRes.ok) throw new Error(`GET files failed: ${filesRes.status}`);
  const filesData = await filesRes.json();
  const projectFiles = filesData.files || [];
  if (!projectFiles.length) {
    throw new Error("No files returned from GET /api/projects/:id/files — project files are missing after generation");
  }
  console.log("   Files:", projectFiles.length, projectFiles.map((f) => f.path).join(", "));

  console.log("4. Creating build job (validate-xcode)...");
  const validateRes = await fetch(`${BASE}/api/projects/${projectId}/validate-xcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: projectFiles,
      projectName: "SmokeTest",
      bundleId: "com.vibetree.test",
      autoFix: true,
    }),
  });
  if (!validateRes.ok) throw new Error(`validate-xcode failed: ${validateRes.status}`);
  const { job } = await validateRes.json();
  if (!job?.id) throw new Error("No job id returned");
  const jobId = job.id;
  console.log("   Job ID:", jobId);

  console.log("5. Polling build job (max 5 min)...");
  const start = Date.now();
  const timeout = 5 * 60 * 1000;
  let finalJob = null;
  while (Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, 3000));
    const jobRes = await fetch(`${BASE}/api/build-jobs/${jobId}`);
    if (!jobRes.ok) throw new Error(`GET job failed: ${jobRes.status}`);
    const j = await jobRes.json();
    const status = j.job?.status ?? j.status;
    if (status === "succeeded") {
      finalJob = j.job ?? j;
      break;
    }
    if (status === "failed") {
      finalJob = j.job ?? j;
      console.error("   Build failed:", finalJob?.compilerErrors?.slice(0, 5) || finalJob?.error);
      throw new Error("Build failed");
    }
    process.stdout.write(".");
  }
  if (!finalJob) throw new Error("Build did not complete within 5 min (runner may not be connected)");
  console.log("\n   Build succeeded.");

  console.log("6. Verifying files on result (job.request.files and GET /files)...");
  const jobRequest = finalJob.request || {};
  const jobFiles = jobRequest.files || [];
  if (!jobFiles.length) {
    console.error("   WARNING: job.request.files is empty — test-suite would use projectFiles from fetch.");
  } else {
    console.log("   job.request.files:", jobFiles.length);
  }

  const getFilesAgain = await fetch(`${BASE}/api/projects/${projectId}/files`);
  const again = await getFilesAgain.json();
  const filesAfterBuild = again.files || [];
  if (!filesAfterBuild.length) {
    throw new Error("GET /api/projects/:id/files returned no files after build — Run on iPhone and Xcode download would have no files");
  }
  console.log("   GET /files after build:", filesAfterBuild.length);

  console.log("\nSmoke test PASSED: pipeline ran, build succeeded, files are present for buttons.");
}

main().catch((e) => {
  console.error("\nSmoke test FAILED:", e.message);
  process.exit(1);
});
