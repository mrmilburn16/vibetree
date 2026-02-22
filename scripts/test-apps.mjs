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
const RESULTS_FILE = join(ROOT, "data", "test-suite-results.jsonl");

/* ────────────────────────── CLI args ────────────────────────── */

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { tier: "all", category: null, limit: null, resume: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tier":
        flags.tier = args[++i];
        break;
      case "--category":
        flags.category = args[++i];
        break;
      case "--limit":
        flags.limit = parseInt(args[++i], 10);
        break;
      case "--resume":
        flags.resume = true;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
    }
  }
  return flags;
}

/* ────────────────────── Parse TS source files ────────────────────── */

function parseAppIdeas(filePath) {
  const content = readFileSync(filePath, "utf8");
  const ideas = [];
  let currentCategory = null;

  for (const line of content.split(/\r?\n/)) {
    const catMatch = line.match(/^\s*"([^"]+)":\s*\[/);
    if (catMatch) {
      currentCategory = catMatch[1];
      continue;
    }
    // title and prompt are delimited by ASCII double-quotes; inner "smart quotes"
    // (U+201C/U+201D) used in prompt text are distinct characters and won't interfere.
    const entryMatch = line.match(
      /\{\s*title:\s*"([^"]*)"\s*,\s*prompt:\s*"([^"]*)"\s*\}/
    );
    if (entryMatch && currentCategory) {
      ideas.push({
        title: entryMatch[1],
        prompt: entryMatch[2],
        category: currentCategory,
      });
    }
  }

  return ideas;
}

function loadAllPrompts() {
  const easyFile = join(ROOT, "src", "lib", "appIdeaPrompts.ts");
  const mediumFile = join(ROOT, "src", "lib", "appIdeaPromptsMedium.ts");
  const easy = parseAppIdeas(easyFile).map((p) => ({ ...p, tier: "easy" }));
  const medium = parseAppIdeas(mediumFile).map((p) => ({ ...p, tier: "medium" }));
  return [...easy, ...medium];
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
  const id = `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

/* ────────────────────────── Results ────────────────────────── */

function loadExistingResults() {
  if (!existsSync(RESULTS_FILE)) return new Set();
  const content = readFileSync(RESULTS_FILE, "utf8");
  const keys = new Set();
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      keys.add(`${obj.tier}:${obj.title}`);
    } catch (_) {}
  }
  return keys;
}

function appendResult(result) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  appendFileSync(RESULTS_FILE, JSON.stringify(result) + "\n");
}

/* ────────────────────── Run single test ────────────────────── */

async function runSingleTest(idea, index, total) {
  process.stdout.write(`[${index + 1}/${total}] Testing: ${idea.title}... `);
  const t0 = Date.now();

  try {
    const project = await createProject(idea.title);
    const projectId = project.id;

    const done = await sendMessage(projectId, idea.prompt);
    const files = done.projectFiles || [];
    if (!files.length) throw new Error("No files generated");

    const job = await triggerValidation(projectId, files, idea.title);
    const { job: finalJob, attempts } = await pollBuildJob(job.id);

    const durationMs = Date.now() - t0;
    const compiled = finalJob.status === "succeeded";

    const result = {
      timestamp: new Date().toISOString(),
      title: idea.title,
      prompt: idea.prompt,
      category: idea.category,
      tier: idea.tier,
      compiled,
      attempts,
      compilerErrors: finalJob.compilerErrors || [],
      durationMs,
      fileCount: files.length,
      fileNames: files.map((f) => f.path),
    };

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

    return result;
  } catch (err) {
    const durationMs = Date.now() - t0;
    const sec = (durationMs / 1000).toFixed(1);
    const msg = err.message || String(err);
    console.log(`ERROR (${sec}s): ${msg.slice(0, 80)}`);

    return {
      timestamp: new Date().toISOString(),
      title: idea.title,
      prompt: idea.prompt,
      category: idea.category,
      tier: idea.tier,
      compiled: false,
      attempts: 0,
      compilerErrors: [msg],
      durationMs,
      fileCount: 0,
      fileNames: [],
    };
  }
}

/* ────────────────────────── Summary ────────────────────────── */

function printSummary(results) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUITE SUMMARY");
  console.log("=".repeat(60));

  const total = results.length;
  const passed = results.filter((r) => r.compiled).length;
  const failed = total - passed;
  const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

  console.log(
    `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Pass rate: ${rate}%`
  );

  console.log("\nPass rate by tier:");
  for (const tier of [...new Set(results.map((r) => r.tier))].sort()) {
    const t = results.filter((r) => r.tier === tier);
    const p = t.filter((r) => r.compiled).length;
    console.log(`  ${tier}: ${p}/${t.length} (${((p / t.length) * 100).toFixed(1)}%)`);
  }

  console.log("\nPass rate by category:");
  for (const cat of [...new Set(results.map((r) => r.category))].sort()) {
    const c = results.filter((r) => r.category === cat);
    const p = c.filter((r) => r.compiled).length;
    console.log(`  ${cat}: ${p}/${c.length} (${((p / c.length) * 100).toFixed(1)}%)`);
  }

  const errCounts = {};
  for (const r of results) {
    if (r.compiled) continue;
    for (const e of r.compilerErrors) {
      const m = e.match(/error:\s*(.+)/);
      const pat = (m ? m[1] : e)
        .replace(/\S+\.swift:\d+(?::\d+)?:\s*/g, "")
        .replace(/\u2018|\u2019/g, "'")
        .trim();
      if (pat) errCounts[pat] = (errCounts[pat] || 0) + 1;
    }
  }
  const sorted = Object.entries(errCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (sorted.length > 0) {
    console.log("\nTop 10 most common error patterns:");
    for (const [pat, cnt] of sorted) {
      console.log(
        `  ${String(cnt).padStart(3)}x  ${pat.length > 70 ? pat.slice(0, 70) + "..." : pat}`
      );
    }
  }

  console.log("\n" + "=".repeat(60));
}

/* ────────────────────────── Main ────────────────────────── */

async function main() {
  const flags = parseArgs();

  console.log("Vibetree Test Runner");
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Results: ${RESULTS_FILE}`);
  console.log(
    `Flags: tier=${flags.tier}, category=${flags.category || "all"}, ` +
      `limit=${flags.limit || "none"}, resume=${flags.resume}, dry-run=${flags.dryRun}`
  );
  console.log("");

  let prompts = loadAllPrompts();
  console.log(`Loaded ${prompts.length} total prompts`);

  if (flags.tier !== "all") {
    prompts = prompts.filter((p) => p.tier === flags.tier);
    console.log(`After tier filter (${flags.tier}): ${prompts.length}`);
  }

  if (flags.category) {
    prompts = prompts.filter((p) =>
      p.category.toLowerCase().includes(flags.category.toLowerCase())
    );
    console.log(`After category filter (${flags.category}): ${prompts.length}`);
  }

  if (flags.resume) {
    const existing = loadExistingResults();
    const before = prompts.length;
    prompts = prompts.filter((p) => !existing.has(`${p.tier}:${p.title}`));
    console.log(
      `After resume filter: ${prompts.length} (skipped ${before - prompts.length} already tested)`
    );
  }

  if (flags.limit && flags.limit > 0) {
    prompts = prompts.slice(0, flags.limit);
    console.log(`After limit: ${prompts.length}`);
  }

  console.log("");

  if (flags.dryRun) {
    console.log("DRY RUN — prompts that would be tested:\n");
    for (let i = 0; i < prompts.length; i++) {
      console.log(
        `  [${String(i + 1).padStart(3)}] [${prompts[i].tier.padEnd(6)}] ` +
          `[${prompts[i].category}] ${prompts[i].title}`
      );
    }
    console.log(`\nTotal: ${prompts.length} prompts`);
    return;
  }

  if (prompts.length === 0) {
    console.log("No prompts to test.");
    return;
  }

  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    const result = await runSingleTest(prompts[i], i, prompts.length);
    results.push(result);
    appendResult(result);
    if (i < prompts.length - 1) await sleep(2000);
  }

  printSummary(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
