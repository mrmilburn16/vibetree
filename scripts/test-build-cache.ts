#!/usr/bin/env npx tsx
/**
 * Automated test for the admin build cache API.
 *
 * Usage:
 *   npx tsx scripts/test-build-cache.ts
 *   BASE_URL=http://localhost:3001 npx tsx scripts/test-build-cache.ts
 *   BASE_URL=https://your-domain.com ADMIN_SECRET=mysecret npx tsx scripts/test-build-cache.ts
 *
 * Requires Node 18+ (uses built-in fetch).
 * Does NOT trigger Claude or Xcode — only tests cache store/retrieve/clear.
 *
 * In local dev the server runs with ADMIN_DEV_BYPASS=true (default), so no
 * cookie is needed. Against staging/production the script logs in first.
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dev-secret-change-me";

// ─── Hash function ────────────────────────────────────────────────────────────
// djb2-style — identical to hashString() in src/lib/proxyCache.ts and hashPrompt()
// in the test-suite page. The server uses this to derive the cache key from the prompt.
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const FAKE_PROMPT = "Build a minimal iOS counter app with increment and decrement buttons.";
const EXPECTED_HASH = hashString(FAKE_PROMPT.trim().toLowerCase());

const FAKE_RESULT = {
  projectId: "test-proj-cache-001",
  projectName: "Test Counter App",
  prompt: FAKE_PROMPT,
  tier: "easy",
  category: "test",
  compiled: true,
  attempts: 1,
  autoFixUsed: false,
  compilerErrors: [] as string[],
  fileCount: 3,
  fileNames: ["ContentView.swift", "CounterApp.swift", "AppState.swift"],
  durationMs: 42_000,
  skillsUsed: [] as string[],
};

const FAKE_PROJECT_FILES: Record<string, string> = {
  "ContentView.swift":
    'import SwiftUI\nstruct ContentView: View { var body: some View { Text("Counter") } }',
  "CounterApp.swift":
    "@main struct CounterApp: App { var body: some Scene { WindowGroup { ContentView() } } }",
  "AppState.swift":
    "import Foundation\nclass AppState: ObservableObject { @Published var count = 0 }",
};

const WRONG_HASH = "notreal999xyz";

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  const tag = ok ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m";
  const suffix = detail ? `  \x1b[2m(${detail})\x1b[0m` : "";
  console.log(`  ${tag}  ${label}${suffix}`);
  if (ok) {
    passCount++;
  } else {
    failCount++;
    failures.push(label + (detail ? ` (${detail})` : ""));
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ─── Admin login ──────────────────────────────────────────────────────────────
// In local dev the server sets ADMIN_DEV_BYPASS=true so no cookie is needed.
// Against staging/prod we POST the admin secret to get a session cookie.
async function tryLogin(): Promise<string | undefined> {
  try {
    const res = await fetch(`${BASE}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: ADMIN_SECRET }),
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/vibetree_admin_session=([^;]+)/);
    if (res.ok && match) return `vibetree_admin_session=${match[1]}`;
  } catch {
    // ignore — dev bypass will cover it
  }
  return undefined;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("\x1b[1m\nBuild Cache API — Automated Tests\x1b[0m");
  console.log(`Target : ${BASE}`);
  console.log(`Hash   : hashString("${FAKE_PROMPT.slice(0, 40)}…") = ${EXPECTED_HASH}`);

  const cookie = await tryLogin();
  const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) {
    baseHeaders["Cookie"] = cookie;
    console.log("Auth   : logged in — using session cookie");
  } else {
    console.log("Auth   : no cookie — assuming ADMIN_DEV_BYPASS is active (local dev)");
  }

  // ── Step 1: Store a build result ────────────────────────────────────────────
  section("Step 1 — POST /api/admin/build-cache  (store entry)");
  const postRes = await fetch(`${BASE}/api/admin/build-cache`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      prompt: FAKE_PROMPT,
      result: FAKE_RESULT,
      projectFiles: FAKE_PROJECT_FILES,
    }),
  });
  const postJson = (await postRes.json().catch(() => ({}))) as Record<string, unknown>;
  check("HTTP 200", postRes.status === 200, `status ${postRes.status}`);
  check("ok: true in response", postJson["ok"] === true);
  check(
    `promptHash matches expected (${EXPECTED_HASH})`,
    postJson["promptHash"] === EXPECTED_HASH,
    `got "${String(postJson["promptHash"])}"`,
  );

  // ── Step 2: Retrieve with correct hash ────────────────────────────────────
  section("Step 2 — GET /api/admin/build-cache?promptHash=<correct>  (cache HIT)");
  const getRes = await fetch(`${BASE}/api/admin/build-cache?promptHash=${EXPECTED_HASH}`, {
    headers: baseHeaders,
  });
  const getJson = (await getRes.json().catch(() => ({}))) as {
    cached?: {
      promptHash?: string;
      cachedAt?: number;
      result?: { compiled?: boolean; fileCount?: number; attempts?: number };
      projectFiles?: Record<string, string>;
    } | null;
  };
  const cached = getJson.cached;
  check("HTTP 200", getRes.status === 200, `status ${getRes.status}`);
  check("cached entry is present", cached != null && cached !== undefined);
  check("cached.promptHash matches", cached?.promptHash === EXPECTED_HASH);
  check("cached.result.compiled === true", cached?.result?.compiled === true);
  check("cached.result.attempts === 1", cached?.result?.attempts === 1);
  check("cached.result.fileCount === 3", cached?.result?.fileCount === 3);
  check("projectFiles has 3 keys", Object.keys(cached?.projectFiles ?? {}).length === 3);
  check(
    "projectFiles contains ContentView.swift",
    "ContentView.swift" in (cached?.projectFiles ?? {}),
  );
  check("cachedAt is a recent timestamp", typeof cached?.cachedAt === "number" && cached.cachedAt > Date.now() - 30_000);

  // ── Step 3: Retrieve with wrong hash ─────────────────────────────────────
  section(`Step 3 — GET /api/admin/build-cache?promptHash=${WRONG_HASH}  (cache MISS)`);
  const missRes = await fetch(`${BASE}/api/admin/build-cache?promptHash=${WRONG_HASH}`, {
    headers: baseHeaders,
  });
  const missJson = (await missRes.json().catch(() => ({}))) as { cached?: unknown };
  check("HTTP 404", missRes.status === 404, `status ${missRes.status}`);
  check("cached is null in body", missJson["cached"] === null);

  // ── Step 4: Stats endpoint ───────────────────────────────────────────────
  section("Step 4 — GET /api/admin/build-cache  (stats, no promptHash)");
  const statsRes = await fetch(`${BASE}/api/admin/build-cache`, { headers: baseHeaders });
  const statsJson = (await statsRes.json().catch(() => ({}))) as {
    size?: number;
    entries?: Array<{ promptHash: string; cachedAt: number; prompt: string }>;
  };
  check("HTTP 200", statsRes.status === 200, `status ${statsRes.status}`);
  check("size >= 1", typeof statsJson.size === "number" && statsJson.size >= 1, `size=${statsJson.size}`);
  check("entries is an array", Array.isArray(statsJson.entries));
  const foundEntry = statsJson.entries?.find((e) => e.promptHash === EXPECTED_HASH);
  check("entries contains our hash", foundEntry != null);

  // ── Step 5: Delete (flush all) ────────────────────────────────────────────
  section("Step 5 — DELETE /api/admin/build-cache  (flush all entries)");
  const delRes = await fetch(`${BASE}/api/admin/build-cache`, {
    method: "DELETE",
    headers: baseHeaders,
  });
  const delJson = (await delRes.json().catch(() => ({}))) as Record<string, unknown>;
  check("HTTP 200", delRes.status === 200, `status ${delRes.status}`);
  check("ok: true in response", delJson["ok"] === true);

  // ── Step 6: Confirm hash is gone after flush ──────────────────────────────
  section("Step 6 — GET /api/admin/build-cache?promptHash=<original> after DELETE  (should be 404)");
  const afterDelRes = await fetch(`${BASE}/api/admin/build-cache?promptHash=${EXPECTED_HASH}`, {
    headers: baseHeaders,
  });
  const afterDelJson = (await afterDelRes.json().catch(() => ({}))) as { cached?: unknown };
  check("HTTP 404 after flush", afterDelRes.status === 404, `status ${afterDelRes.status}`);
  check("cached is null after flush", afterDelJson["cached"] === null);

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passCount + failCount;
  console.log(`\n${"─".repeat(50)}`);
  if (failCount === 0) {
    console.log(`\x1b[32m✓ All ${total} checks passed.\x1b[0m\n`);
  } else {
    console.log(`\x1b[31m✗ ${failCount}/${total} checks FAILED:\x1b[0m`);
    for (const f of failures) console.log(`    - ${f}`);
    console.log();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31mUnhandled error:\x1b[0m", err);
  process.exit(1);
});
