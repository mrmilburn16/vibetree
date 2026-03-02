#!/usr/bin/env node
/**
 * Run the Next.js dev server and the Mac runner together so "Run on iPhone"
 * preflight passes without opening a second terminal.
 *
 * Usage: npm run dev:full
 * Requires: MAC_RUNNER_TOKEN in .env.local (same as server uses).
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) {
  console.error("[dev:full] No .env.local found. Create it and add MAC_RUNNER_TOKEN=your-secret (same value as API Token in the iOS app Settings).");
  process.exit(1);
}
const envContent = readFileSync(envPath, "utf8");
const hasToken = /MAC_RUNNER_TOKEN\s*=\s*[^\s#]/.test(envContent) || /MAC_RUNNER_TOKEN\s*=\s*["'][^"']+["']/.test(envContent);
if (!hasToken) {
  console.error("[dev:full] Add MAC_RUNNER_TOKEN=your-secret to .env.local (same value as API Token in the iOS app Settings).");
  process.exit(1);
}

const dev = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FORCE_COLOR: "1" },
});

let runnerProcess = null;
const killAll = () => {
  dev.kill("SIGTERM");
  if (runnerProcess) runnerProcess.kill("SIGTERM");
};
process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);

// Give the server a moment to bind before starting the runner (runner will retry).
setTimeout(() => {
  runnerProcess = spawn("node", ["scripts/mac-runner.mjs"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, VIBETREE_SERVER_URL: "http://localhost:3001" },
  });

  runnerProcess.on("error", (err) => {
    console.error("[dev:full] Mac runner failed to start:", err.message);
  });
  runnerProcess.on("exit", (code) => {
    if (code != null && code !== 0) console.error("[dev:full] Mac runner exited with code", code);
  });
}, 3000);

dev.on("error", (err) => {
  console.error("[dev:full] Dev server failed to start:", err.message);
  process.exit(1);
});
dev.on("exit", (code, signal) => {
  if (code != null && code !== 0) process.exit(code);
  if (signal) process.exit(1);
});
