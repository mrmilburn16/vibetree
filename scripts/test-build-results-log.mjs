#!/usr/bin/env node
/**
 * Verifies that build-results logging works: POST a simulated build, then GET and assert.
 * Requires the dev server to be running: npm run dev (port 3001).
 * Run: node scripts/test-build-results-log.mjs
 */
const BASE = "http://localhost:3001";

async function main() {
  const testId = `test-${Date.now()}`;
  const payload = {
    projectId: testId,
    projectName: "Build-Results Test",
    prompt: "Simulated build for testing the build-results pipeline.",
    tier: "custom",
    category: "Test",
    compiled: true,
    attempts: 2,
    autoFixUsed: true,
    compilerErrors: [],
    fileCount: 2,
    fileNames: ["App.swift", "ContentView.swift"],
    durationMs: 120000,
  };

  let res = await fetch(`${BASE}/api/build-results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("POST failed:", res.status, await res.text());
    process.exit(1);
  }
  const postData = await res.json();
  const id = postData?.result?.id;
  if (!id) {
    console.error("POST response missing result.id:", postData);
    process.exit(1);
  }
  console.log("Posted build result:", id);

  res = await fetch(`${BASE}/api/build-results?limit=5`);
  if (!res.ok) {
    console.error("GET list failed:", res.status);
    process.exit(1);
  }
  const listData = await res.json();
  const found = listData?.results?.find((r) => r.id === id);
  if (!found) {
    console.error("GET list did not return the new result. IDs:", listData?.results?.map((r) => r.id));
    process.exit(1);
  }
  if (found.projectId !== testId || found.compiled !== true || found.attempts !== 2) {
    console.error("GET result fields mismatch:", found);
    process.exit(1);
  }
  console.log("GET list returned the new result.");

  res = await fetch(`${BASE}/api/build-results?stats=true`);
  if (!res.ok) {
    console.error("GET stats failed:", res.status);
    process.exit(1);
  }
  const stats = await res.json();
  if (stats.total < 1) {
    console.error("Stats total should be >= 1, got:", stats.total);
    process.exit(1);
  }
  console.log("Stats OK: total =", stats.total);

  console.log("\nBuild results logging is working. Dashboard: " + BASE + "/admin/builds");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
