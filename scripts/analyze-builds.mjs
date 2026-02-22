#!/usr/bin/env node
/**
 * Analyze build results from data/build-results.jsonl.
 * Run: node scripts/analyze-builds.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const LOG_PATH = join(process.cwd(), "data", "build-results.jsonl");

if (!existsSync(LOG_PATH)) {
  console.log("No build results yet. Build some apps first.");
  process.exit(0);
}

const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
const results = lines.map((l) => JSON.parse(l));

if (results.length === 0) {
  console.log("No build results yet.");
  process.exit(0);
}

const total = results.length;
const compiled = results.filter((r) => r.compiled).length;
const failed = total - compiled;
const rate = Math.round((compiled / total) * 100);

console.log(`\n${"=".repeat(60)}`);
console.log(`  BUILD RESULTS SUMMARY`);
console.log(`${"=".repeat(60)}\n`);
console.log(`  Total builds:    ${total}`);
console.log(`  Compiled:        ${compiled} (${rate}%)`);
console.log(`  Failed:          ${failed} (${100 - rate}%)`);

const autoFixed = results.filter((r) => r.autoFixUsed).length;
const avgAttempts = (results.reduce((s, r) => s + r.attempts, 0) / total).toFixed(1);
console.log(`  Auto-fix used:   ${autoFixed} (${Math.round((autoFixed / total) * 100)}%)`);
console.log(`  Avg attempts:    ${avgAttempts}`);

const designScores = results.filter((r) => r.userDesignScore !== null);
const funcScores = results.filter((r) => r.userFunctionalScore !== null);
if (designScores.length > 0) {
  const avgDesign = (designScores.reduce((s, r) => s + r.userDesignScore, 0) / designScores.length).toFixed(1);
  console.log(`  Avg design:      ${avgDesign}/5 (${designScores.length} rated)`);
}
if (funcScores.length > 0) {
  const avgFunc = (funcScores.reduce((s, r) => s + r.userFunctionalScore, 0) / funcScores.length).toFixed(1);
  console.log(`  Avg function:    ${avgFunc}/5 (${funcScores.length} rated)`);
}

const byTier = {};
for (const r of results) {
  if (!byTier[r.tier]) byTier[r.tier] = { total: 0, compiled: 0 };
  byTier[r.tier].total++;
  if (r.compiled) byTier[r.tier].compiled++;
}
if (Object.keys(byTier).length > 0) {
  console.log(`\n  BY TIER:`);
  for (const [tier, d] of Object.entries(byTier)) {
    const pct = Math.round((d.compiled / d.total) * 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    console.log(`    ${tier.padEnd(10)} ${bar} ${d.compiled}/${d.total} (${pct}%)`);
  }
}

const errorCounts = {};
for (const r of results) {
  for (const e of r.compilerErrors || []) {
    const norm = e.replace(/\S+\.swift:\d+(:\d+)?:\s*/, "").trim();
    if (norm) errorCounts[norm] = (errorCounts[norm] || 0) + 1;
  }
}
const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
if (topErrors.length > 0) {
  console.log(`\n  TOP ERRORS (fixable by improving system prompt or rule-based fixes):`);
  for (const [err, count] of topErrors) {
    console.log(`    ${String(count).padStart(3)}x  ${err.slice(0, 80)}`);
  }
}

const withNotes = results.filter((r) => r.userNotes);
if (withNotes.length > 0) {
  console.log(`\n  YOUR NOTES:`);
  for (const r of withNotes) {
    const status = r.compiled ? "✓" : "✗";
    const prompt = (r.prompt || r.projectName).slice(0, 50);
    console.log(`    ${status} "${prompt}…"`);
    console.log(`      → ${r.userNotes}`);
  }
}

console.log(`\n${"=".repeat(60)}\n`);
