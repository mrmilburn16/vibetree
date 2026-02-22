#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

/* ────────────────────────── .env.local ────────────────────────── */

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch (_) {}
}

loadEnvLocal();

const SERVER_URL =
  process.env.SERVER_URL || process.env.VIBETREE_SERVER_URL || "http://localhost:3001";
const RESULTS_INPUT = join(ROOT, "data", "test-suite-results.jsonl");
const RESULTS_OUTPUT = join(ROOT, "data", "regression-test-results.jsonl");

/* ────────────────────────── CLI args ────────────────────────── */

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { limit: null, top: 20, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--limit":
        flags.limit = parseInt(args[++i], 10);
        break;
      case "--top":
        flags.top = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
    }
  }
  return flags;
}

/* ────────────────────── Load & rank failures ────────────────────── */

function loadTestSuiteResults() {
  if (!existsSync(RESULTS_INPUT)) {
    console.error(`Error: ${RESULTS_INPUT} not found.`);
    console.error("Run the test suite (test-apps.mjs) first to generate results.");
    process.exit(1);
  }

  const content = readFileSync(RESULTS_INPUT, "utf8");
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (_) {}
  }
  return entries;
}

function findTopFailedPrompts(entries, topN) {
  const byPrompt = new Map();

  for (const entry of entries) {
    const key = entry.prompt;
    if (!byPrompt.has(key)) {
      byPrompt.set(key, {
        title: entry.title,
        prompt: entry.prompt,
        category: entry.category || "",
        tier: entry.tier || "",
        failCount: 0,
        totalRuns: 0,
        latestEntry: entry,
      });
    }

    const record = byPrompt.get(key);
    record.totalRuns++;
    if (!entry.compiled) record.failCount++;

    if (new Date(entry.timestamp) > new Date(record.latestEntry.timestamp)) {
      record.latestEntry = entry;
    }
  }

  const failed = [...byPrompt.values()]
    .filter((r) => r.failCount > 0)
    .sort((a, b) => b.failCount - a.failCount || a.title.localeCompare(b.title));

  return failed.slice(0, topN);
}

/* ────────────────────────── Helpers ────────────────────────── */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body) headers["Content-Type"] = "application/json";
  return fetch(`${SERVER_URL}${path}`, { ...opts, headers });
}

/* ────────────────────── Pipeline steps ────────────────────── */

async function createProject(title) {
  const id = `regtest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const res = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: title, id }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sendMessage(projectId, prompt) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5 * 60 * 1000);

  try {
    const res = await fetch(`${SERVER_URL}/api/projects/${projectId}/message/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt, projectType: "pro" }),
      signal: ac.signal,
    });

    if (!res.ok) throw new Error(`Message stream failed: ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());

    let donePayload = null;
    let errorPayload = null;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "done") donePayload = obj;
        else if (obj.type === "error") errorPayload = obj;
      } catch (_) {}
    }

    if (errorPayload) throw new Error(errorPayload.error || "Stream error");
    if (!donePayload) throw new Error("No 'done' event in stream");
    return donePayload;
  } finally {
    clearTimeout(timer);
  }
}

async function triggerValidation(projectId, files, projectName) {
  const res = await api(`/api/projects/${projectId}/validate-xcode`, {
    method: "POST",
    body: JSON.stringify({
      files,
      projectName,
      bundleId: "com.vibetree.test",
      autoFix: true,
      attempt: 1,
      maxAttempts: 5,
    }),
  });
  if (!res.ok) throw new Error(`Validate-xcode failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.job;
}

async function pollBuildJob(jobId) {
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 10 * 60 * 1000;
  const start = Date.now();
  let attempts = 1;
  let currentId = jobId;

  while (Date.now() - start < MAX_POLL_TIME) {
    const res = await api(`/api/build-jobs/${currentId}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    const { job } = await res.json();

    if (job.status === "succeeded") return { job, attempts };

    if (job.status === "failed") {
      if (job.nextJobId) {
        currentId = job.nextJobId;
        attempts++;
        continue;
      }
      if (job.autoFixInProgress) {
        await sleep(POLL_INTERVAL);
        continue;
      }
      return { job, attempts };
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error("Build job timed out after 10 minutes");
}

/* ────────────────────── Run single test ────────────────────── */

async function runSingleTest(record, index, total) {
  const label = `[${index + 1}/${total}]`;
  process.stdout.write(`${label} Re-testing: ${record.title}... `);
  const t0 = Date.now();

  try {
    const project = await createProject(record.title);
    const projectId = project.id;

    const done = await sendMessage(projectId, record.prompt);
    const files = done.projectFiles || [];
    if (!files.length) throw new Error("No files generated");

    const job = await triggerValidation(projectId, files, record.title);
    const { job: finalJob, attempts } = await pollBuildJob(job.id);

    const durationMs = Date.now() - t0;
    const compiled = finalJob.status === "succeeded";
    const sec = (durationMs / 1000).toFixed(1);

    if (compiled) {
      console.log(`PASS (${attempts} attempt${attempts > 1 ? "s" : ""}, ${sec}s)`);
    } else {
      const firstErr =
        (finalJob.compilerErrors || [])[0] || finalJob.error || "Unknown error";
      const short = firstErr.length > 80 ? firstErr.slice(0, 80) + "..." : firstErr;
      console.log(
        `FAIL (${attempts} attempt${attempts > 1 ? "s" : ""}, ${sec}s): ${short}`
      );
    }

    return {
      compiled,
      attempts,
      compilerErrors: finalJob.compilerErrors || [],
      durationMs,
      fileCount: files.length,
      fileNames: files.map((f) => f.path),
    };
  } catch (err) {
    const durationMs = Date.now() - t0;
    const sec = (durationMs / 1000).toFixed(1);
    const msg = err.message || String(err);
    console.log(`ERROR (${sec}s): ${msg.slice(0, 80)}`);

    return {
      compiled: false,
      attempts: 0,
      compilerErrors: [msg],
      durationMs,
      fileCount: 0,
      fileNames: [],
    };
  }
}

/* ────────────────────────── Results ────────────────────────── */

function appendRegressionResult(result) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  appendFileSync(RESULTS_OUTPUT, JSON.stringify(result) + "\n");
}

function printReport(testResults) {
  const improved = testResults.filter((r) => !r.previousCompiled && r.newCompiled);
  const regressed = testResults.filter((r) => r.previousCompiled && !r.newCompiled);
  const unchanged = testResults.filter(
    (r) => r.previousCompiled === r.newCompiled
  );

  const prevPassCount = testResults.filter((r) => r.previousCompiled).length;
  const newPassCount = testResults.filter((r) => r.newCompiled).length;
  const total = testResults.length;
  const prevRate = total > 0 ? ((prevPassCount / total) * 100).toFixed(0) : "0";
  const newRate = total > 0 ? ((newPassCount / total) * 100).toFixed(0) : "0";

  console.log("");
  console.log("=".repeat(60));
  console.log("  REGRESSION TEST RESULTS");
  console.log("=".repeat(60));
  console.log("");
  console.log(`  Re-tested: ${total} prompts (all previously failed)`);
  console.log("");

  console.log("  IMPROVED (now passes):");
  if (improved.length === 0) {
    console.log("    (none)");
  } else {
    for (const r of improved) {
      console.log(
        `    \u2713 ${r.title} (was: ${r.previousAttempts} attempt${r.previousAttempts !== 1 ? "s" : ""} failed, now: ${r.newAttempts} attempt${r.newAttempts !== 1 ? "s" : ""} passed)`
      );
    }
  }
  console.log("");

  console.log("  REGRESSED (now fails):");
  if (regressed.length === 0) {
    console.log("    \u2717 (none)");
  } else {
    for (const r of regressed) {
      const err = (r.newErrors[0] || "Unknown error").slice(0, 60);
      console.log(`    \u2717 ${r.title}: ${err}`);
    }
  }
  console.log("");

  console.log("  UNCHANGED (still fails):");
  const unchangedFails = unchanged.filter((r) => !r.newCompiled);
  const unchangedPasses = unchanged.filter((r) => r.newCompiled);
  if (unchangedFails.length === 0 && unchangedPasses.length === 0) {
    console.log("    (none)");
  } else {
    for (const r of unchangedFails) {
      const err = extractShortError(r.newErrors[0] || "Unknown error");
      console.log(`    \u2717 ${r.title}: ${err}`);
    }
    for (const r of unchangedPasses) {
      console.log(`    \u2713 ${r.title} (still passes)`);
    }
  }
  console.log("");

  console.log(
    `  Summary: ${improved.length} improved, ${regressed.length} regressed, ${unchanged.length} unchanged`
  );
  console.log(`  Previous pass rate: ${prevRate}% -> New pass rate: ${newRate}%`);
  console.log("");
  console.log("=".repeat(60));
}

function extractShortError(err) {
  const m = err.match(/error:\s*(.+)/);
  const cleaned = (m ? m[1] : err)
    .replace(/\S+\.swift:\d+(?::\d+)?:\s*/g, "")
    .replace(/\u2018|\u2019/g, "'")
    .trim();
  return cleaned.length > 70 ? cleaned.slice(0, 70) + "..." : cleaned;
}

/* ────────────────────────── Main ────────────────────────── */

async function main() {
  const flags = parseArgs();
  const runId = `regrun_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  console.log("Vibetree Regression Test Runner");
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Input:  ${RESULTS_INPUT}`);
  console.log(`Output: ${RESULTS_OUTPUT}`);
  console.log(
    `Flags: top=${flags.top}, limit=${flags.limit || "none"}, dry-run=${flags.dryRun}`
  );
  console.log(`Run ID: ${runId}`);
  console.log("");

  const entries = loadTestSuiteResults();
  console.log(`Loaded ${entries.length} historical results`);

  const topFailed = findTopFailedPrompts(entries, flags.top);
  console.log(
    `Found ${topFailed.length} failed prompts (selecting top ${flags.top} by failure count)`
  );

  let candidates = topFailed;
  if (flags.limit && flags.limit > 0) {
    candidates = candidates.slice(0, flags.limit);
    console.log(`After --limit: ${candidates.length}`);
  }

  console.log("");

  if (flags.dryRun) {
    console.log("DRY RUN — prompts that would be re-tested:\n");
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const lastResult = c.latestEntry.compiled ? "PASS" : "FAIL";
      console.log(
        `  [${String(i + 1).padStart(3)}] ${c.title}`
      );
      console.log(
        `        failures: ${c.failCount}/${c.totalRuns} runs, last result: ${lastResult}`
      );
      if (!c.latestEntry.compiled && c.latestEntry.compilerErrors?.length) {
        const err = extractShortError(c.latestEntry.compilerErrors[0]);
        console.log(`        last error: ${err}`);
      }
    }
    console.log(`\nTotal: ${candidates.length} prompts would be re-tested`);
    return;
  }

  if (candidates.length === 0) {
    console.log("No failed prompts to re-test.");
    return;
  }

  console.log(`Starting regression tests (${candidates.length} prompts)...\n`);

  const testResults = [];

  for (let i = 0; i < candidates.length; i++) {
    const record = candidates[i];
    const prev = record.latestEntry;

    const newResult = await runSingleTest(record, i, candidates.length);

    const resultEntry = {
      timestamp: new Date().toISOString(),
      runId,
      promptTitle: record.title,
      prompt: record.prompt,
      category: record.category,
      tier: record.tier,
      previousResult: prev.compiled ? "pass" : "fail",
      previousAttempts: prev.attempts,
      previousErrors: prev.compilerErrors || [],
      newResult: newResult.compiled ? "pass" : "fail",
      newAttempts: newResult.attempts,
      newErrors: newResult.compilerErrors,
      durationMs: newResult.durationMs,
      fileCount: newResult.fileCount,
      fileNames: newResult.fileNames,
      failHistory: `${record.failCount}/${record.totalRuns}`,
    };

    appendRegressionResult(resultEntry);

    testResults.push({
      title: record.title,
      previousCompiled: prev.compiled,
      previousAttempts: prev.attempts,
      newCompiled: newResult.compiled,
      newAttempts: newResult.attempts,
      newErrors: newResult.compilerErrors,
    });

    if (i < candidates.length - 1) await sleep(2000);
  }

  printReport(testResults);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
