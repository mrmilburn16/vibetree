#!/usr/bin/env node
/**
 * After pushing to GitHub, verify the latest Vercel deployment built successfully.
 * Requires VERCEL_TOKEN in env. Optional: VERCEL_PROJECT_ID, VERCEL_TEAM_ID.
 *
 * Usage: node scripts/vercel-build-status.mjs [maxWaitSeconds]
 * Exits 0 if latest deployment is READY, 1 if ERROR/CANCELED or timeout.
 */

const VERCEL_API = "https://api.vercel.com";
const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;
const maxWaitSeconds = Math.min(600, parseInt(process.argv[2] || "300", 10) || 300);

if (!token) {
  console.log("VERCEL_TOKEN not set — skipping Vercel build verification.");
  process.exit(0);
}

const headers = { Authorization: `Bearer ${token}` };

function buildUrl(path, params = {}) {
  const u = new URL(path, VERCEL_API);
  Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  return u.toString();
}

async function listDeployments() {
  const url = buildUrl("/v6/deployments", {
    limit: 5,
    projectId: projectId || undefined,
    teamId: teamId || undefined,
  });
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function getDeployment(idOrUrl) {
  const url = buildUrl(`/v13/deployments/${encodeURIComponent(idOrUrl)}`, {
    teamId: teamId || undefined,
  });
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const TERMINAL_STATES = new Set(["READY", "ERROR", "CANCELED"]);

async function main() {
  const start = Date.now();
  console.log("Checking latest Vercel deployment…");
  const { deployments } = await listDeployments();
  if (!deployments?.length) {
    console.log("No deployments found.");
    process.exit(1);
  }
  const latest = deployments[0];
  const id = latest.uid || latest.id;
  const state = latest.state || latest.readyState;
  const url = latest.url ? `https://${latest.url}` : id;
  console.log(`Latest: ${url} state=${state}`);

  let current = latest;
  while (!TERMINAL_STATES.has(current.state || current.readyState)) {
    if ((Date.now() - start) / 1000 > maxWaitSeconds) {
      console.log("Timeout waiting for deployment to finish.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 8000));
    current = await getDeployment(id);
    const s = current.state || current.readyState;
    console.log(`  … ${s}`);
  }

  const finalState = current.state || current.readyState;
  if (finalState === "READY") {
    console.log("Vercel build succeeded.");
    process.exit(0);
  }
  console.log(`Vercel build failed (state=${finalState}).`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
