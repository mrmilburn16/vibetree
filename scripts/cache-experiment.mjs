#!/usr/bin/env node

/**
 * Prompt Caching Cost Experiment
 *
 * Runs 3 trials with the same prompt sequence to compare real Anthropic billing
 * under different caching strategies: no cache, 5-minute TTL, and 1-hour TTL.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/cache-experiment.mjs
 *
 * Each trial sends 3 messages (new app → follow-up → follow-up) with ~30s gaps.
 * Total runtime: ~10 minutes. Total cost: ~$2-4.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
  process.exit(1);
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 32000;
const GAP_BETWEEN_MESSAGES_MS = 30_000;

// Use the real production system prompt so it exceeds the 1,024-token
// minimum required for caching on Sonnet 4.6.
const __dirname = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(
  join(__dirname, "../src/lib/llm/claudeAdapter.ts"),
  "utf8"
);
const swiftMatch = adapterSource.match(
  /const SYSTEM_PROMPT_SWIFT = `([\s\S]*?)`;/
);
if (!swiftMatch) {
  console.error("Could not extract SYSTEM_PROMPT_SWIFT from claudeAdapter.ts");
  process.exit(1);
}
const SYSTEM_PROMPT = swiftMatch[1];
console.log(
  `System prompt loaded: ~${Math.ceil(SYSTEM_PROMPT.length / 4)} tokens (${SYSTEM_PROMPT.length} chars)\n`
);

const MESSAGES = [
  "Build me a fitness tracker with activity rings that shows daily steps, calories burned, and exercise minutes",
  "Add a settings page with a dark mode toggle and the ability to set daily goals",
  "Change the accent color to blue and add a weekly progress chart",
];

/** Sonnet 4.6 pricing per million tokens */
const PRICE = {
  input: 3,
  output: 15,
  cacheWrite5m: 3.75,   // 1.25x input
  cacheWrite1h: 6,      // 2x input
  cacheRead: 0.3,       // 0.1x input
};

function computeCost(usage, trial) {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  const outputCost = (outputTokens / 1e6) * PRICE.output;
  const inputCost = (inputTokens / 1e6) * PRICE.input;

  let writeCost = 0;
  if (trial === "B") writeCost = (cacheWrite / 1e6) * PRICE.cacheWrite5m;
  else if (trial === "C") writeCost = (cacheWrite / 1e6) * PRICE.cacheWrite1h;

  const readCost = (cacheRead / 1e6) * PRICE.cacheRead;

  return inputCost + writeCost + readCost + outputCost;
}

function buildCacheControl(trialType) {
  if (trialType === "A") return undefined;
  if (trialType === "C") return { type: "ephemeral", ttl: "1h" };
  return { type: "ephemeral" }; // Trial B: default 5-min TTL
}

function buildUserContent(messageIdx, previousFiles) {
  const userMsg = MESSAGES[messageIdx];
  if (messageIdx === 0 || !previousFiles) {
    return userMsg;
  }
  return `Current project files (apply the user's request to these and output the full updated JSON):\n${JSON.stringify(previousFiles)}\n\nUser request: ${userMsg}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pad(str, len) {
  return String(str).padEnd(len);
}
function padR(str, len) {
  return String(str).padStart(len);
}

async function runTrial(trialType, label) {
  const client = new Anthropic({ apiKey: API_KEY });
  const results = [];
  let previousFiles = null;

  console.log(`\n--- Trial ${trialType}: ${label} ---`);

  for (let i = 0; i < MESSAGES.length; i++) {
    if (i > 0) {
      console.log(`  Waiting ${GAP_BETWEEN_MESSAGES_MS / 1000}s before next message...`);
      await sleep(GAP_BETWEEN_MESSAGES_MS);
    }

    console.log(`  Request ${i + 1}/3: "${MESSAGES[i].slice(0, 60)}..."`);
    const startMs = Date.now();

    const cacheControl = buildCacheControl(trialType);
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(i, previousFiles) }],
      ...(cacheControl && { cache_control: cacheControl }),
    };

    try {
      const stream = client.messages.stream(params);
      const response = await stream.finalMessage();
      const elapsed = Date.now() - startMs;
      const usage = response.usage ?? {};

      const content = response.content ?? [];
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      try {
        const parsed = JSON.parse(text);
        if (parsed.files && Array.isArray(parsed.files)) {
          previousFiles = parsed.files;
        }
      } catch {
        // Non-JSON response; keep previous files
      }

      results.push({
        request: i + 1,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cost: computeCost(usage, trialType),
        elapsedMs: elapsed,
      });

      console.log(
        `    Done in ${(elapsed / 1000).toFixed(1)}s | ` +
        `in=${usage.input_tokens ?? 0} out=${usage.output_tokens ?? 0} ` +
        `write=${usage.cache_creation_input_tokens ?? 0} read=${usage.cache_read_input_tokens ?? 0}`
      );
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      results.push({
        request: i + 1,
        inputTokens: 0, outputTokens: 0,
        cacheWriteTokens: 0, cacheReadTokens: 0,
        cost: 0, elapsedMs: 0, error: err.message,
      });
    }
  }

  return { trial: trialType, label, results };
}

function printResults(allTrials) {
  const sep = "─".repeat(100);

  console.log("\n\n" + "=".repeat(100));
  console.log("  PROMPT CACHING COST EXPERIMENT — RESULTS");
  console.log("=".repeat(100));
  console.log(
    `${pad("Trial", 20)}| ${padR("Req", 4)} | ${padR("Input", 8)} | ${padR("Cache Write", 12)} | ${padR("Cache Read", 11)} | ${padR("Output", 8)} | ${padR("Cost", 8)} | ${padR("Time", 6)}`
  );
  console.log(sep);

  for (const trial of allTrials) {
    let totalCost = 0;
    for (const r of trial.results) {
      totalCost += r.cost;
      console.log(
        `${pad(`${trial.trial}: ${trial.label}`, 20)}| ${padR(r.request, 4)} | ${padR(r.inputTokens.toLocaleString(), 8)} | ${padR(r.cacheWriteTokens.toLocaleString(), 12)} | ${padR(r.cacheReadTokens.toLocaleString(), 11)} | ${padR(r.outputTokens.toLocaleString(), 8)} | ${padR(`$${r.cost.toFixed(4)}`, 8)} | ${padR(`${(r.elapsedMs / 1000).toFixed(0)}s`, 6)}`
      );
    }
    console.log(
      `${pad(`${trial.trial}: TOTAL`, 20)}| ${padR(trial.results.length, 4)} | ${padR("", 8)} | ${padR("", 12)} | ${padR("", 11)} | ${padR("", 8)} | ${padR(`$${totalCost.toFixed(4)}`, 8)} |`
    );
    console.log(sep);
  }

  const costs = allTrials.map((t) => ({
    label: t.label,
    total: t.results.reduce((s, r) => s + r.cost, 0),
  }));

  console.log("\n  SUMMARY");
  console.log(sep);
  for (const c of costs) {
    const savingsVsNone = costs[0].total - c.total;
    const savingsPct = costs[0].total > 0 ? (savingsVsNone / costs[0].total) * 100 : 0;
    const savingsStr = savingsVsNone > 0
      ? `  (saves $${savingsVsNone.toFixed(4)}, ${savingsPct.toFixed(1)}%)`
      : "";
    console.log(`  ${pad(c.label, 18)} $${c.total.toFixed(4)}${savingsStr}`);
  }
  console.log(sep);
  console.log("\n  Recommendation: Choose the TTL with the best savings % for your usage pattern.");
  console.log("  If savings are similar, prefer 1-hour for more resilience to longer user gaps.\n");
}

async function main() {
  console.log("Prompt Caching Cost Experiment");
  console.log(`Model: ${MODEL}`);
  console.log(`Messages per trial: ${MESSAGES.length}`);
  console.log(`Gap between messages: ${GAP_BETWEEN_MESSAGES_MS / 1000}s`);
  console.log(`Estimated total cost: $2-4 for all 9 requests`);
  console.log(`Estimated runtime: ~10 minutes\n`);

  const trials = [];

  trials.push(await runTrial("A", "No cache"));
  console.log("\n  Waiting 10s before next trial to ensure no cache carryover...");
  await sleep(10_000);

  trials.push(await runTrial("B", "5-min cache"));
  console.log("\n  Waiting 10s before next trial...");
  await sleep(10_000);

  trials.push(await runTrial("C", "1-hour cache"));

  printResults(trials);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
