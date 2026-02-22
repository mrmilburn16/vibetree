import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** How long to stream simulator frames after a successful build (ms). */
const SIMULATOR_STREAM_DURATION_MS = 5 * 60 * 1000;
/** Interval between screenshot frames (ms). */
const SIMULATOR_FRAME_INTERVAL_MS = 200;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** Load .env.local from project root so MAC_RUNNER_TOKEN, VIBETREE_SERVER_URL, XCODEBUILD_PATH work with just npm run mac-runner. */
function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch (_) {}
}

loadEnvLocal();

/** Resolve xcodebuild path so it works when PATH doesn't include Xcode (e.g. non-interactive shell). Returns { path, tried } for logging. */
function getXcodebuildPath() {
  const tried = [];
  const explicit = process.env.XCODEBUILD_PATH?.trim();
  if (explicit) tried.push(resolve(explicit));
  const home = process.env.HOME || homedir();
  if (home) tried.push(resolve(home, "Downloads", "Xcode.app", "Contents", "Developer", "usr", "bin", "xcodebuild"));
  tried.push("/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild");
  try {
    const devDir = execSync("xcode-select -p", { encoding: "utf8", shell: true }).trim();
    if (devDir) tried.push(resolve(devDir, "usr", "bin", "xcodebuild"));
  } catch (_) {}
  for (const p of tried) {
    if (p && existsSync(p)) return { path: p, tried };
  }
  return { path: "xcodebuild", tried };
}

const SERVER_URL = process.env.VIBETREE_SERVER_URL || "http://localhost:3001";
const TOKEN = process.env.MAC_RUNNER_TOKEN;
const RUNNER_ID = process.env.MAC_RUNNER_ID || `mac_${process.pid}`;

if (!TOKEN) {
  console.error("Missing MAC_RUNNER_TOKEN in env.");
  process.exit(1);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function api(path, opts = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "X-Runner-Id": RUNNER_ID,
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function claimJob() {
  const res = await api("/api/build-jobs/next", { method: "POST" });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.job;
}

async function updateJob(jobId, payload) {
  const res = await api(`/api/build-jobs/${jobId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status} ${await res.text()}`);
}

async function downloadZip(job) {
  const hasFiles = Array.isArray(job.request.files) && job.request.files.length > 0;

  const res = hasFiles
    ? await fetch(`${SERVER_URL}/api/projects/${job.request.projectId}/export-xcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: job.request.projectName,
          bundleId: job.request.bundleId,
          developmentTeam: job.request.developmentTeam || "",
          files: job.request.files,
        }),
      })
    : await fetch(`${SERVER_URL}/api/projects/${job.request.projectId}/export-xcode`);
  if (!res.ok) throw new Error(`export-xcode failed: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

function run(cmd, args, { cwd, onLine }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let outBuf = "";
    let errBuf = "";

    child.on("error", (err) => reject(err));

    const handleChunk = (chunk, isErr) => {
      const s = chunk.toString("utf8");
      if (isErr) errBuf += s;
      else outBuf += s;
      const combined = s.split(/\r?\n/);
      for (const line of combined) {
        if (!line) continue;
        onLine?.(line);
      }
    };

    child.stdout.on("data", (c) => handleChunk(c, false));
    child.stderr.on("data", (c) => handleChunk(c, true));
    child.on("close", (code) => resolve({ code: code ?? 1, out: outBuf, err: errBuf }));
  });
}

/**
 * Boot simulator, install app, launch it; then stream screenshots to the server in the background.
 * We await until install+launch are done so the caller can safely delete tmp; the screenshot loop
 * runs via setImmediate and does not need the .app path.
 */
async function runSimulatorStream(projectId, appPath, bundleId) {
  if (!existsSync(appPath)) {
    console.warn("[simulator-stream] .app not found:", appPath);
    return;
  }
  const deviceName = "iPhone 16";
  try {
    await run("xcrun", ["simctl", "boot", deviceName], { onLine: () => {} }).catch(() => {});
  } catch (_) {}
  try {
    const installRes = await run("xcrun", ["simctl", "install", "booted", appPath], { onLine: () => {} });
    if (installRes.code !== 0) {
      console.warn("[simulator-stream] install failed:", installRes.err?.slice(0, 200));
      return;
    }
  } catch (e) {
    console.warn("[simulator-stream] install error:", e?.message || e);
    return;
  }
  try {
    await run("xcrun", ["simctl", "launch", "booted", bundleId], { onLine: () => {} });
  } catch (e) {
    console.warn("[simulator-stream] launch error:", e?.message || e);
  }
  setImmediate(() => {
    runScreenshotLoop(projectId).catch((err) =>
      console.error("[simulator-stream] screenshot loop:", err?.message || err)
    );
  });
}

async function runScreenshotLoop(projectId) {
  const screenshotPath = join(tmpdir(), `vibetree-sim-${projectId}-${Date.now()}.png`);
  const start = Date.now();
  try {
    while (Date.now() - start < SIMULATOR_STREAM_DURATION_MS) {
      try {
        const ioRes = await run("xcrun", ["simctl", "io", "booted", "screenshot", screenshotPath], {
          onLine: () => {},
        });
        if (ioRes.code === 0) {
          const buf = await readFile(screenshotPath);
          const res = await api(`/api/projects/${projectId}/simulator-frame`, {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: buf,
          });
          if (!res.ok) break;
        }
      } catch (_) {}
      await sleep(SIMULATOR_FRAME_INTERVAL_MS);
    }
  } finally {
    try {
      await rm(screenshotPath, { force: true });
    } catch (_) {}
  }
}

async function validateJob(job) {
  await updateJob(job.id, { status: "running", logs: [`Runner ${RUNNER_ID} validating…`] });

  const tmp = await mkdtemp(join(tmpdir(), "vibetree-build-"));
  const zipPath = join(tmp, "project.zip");
  const unzipDir = join(tmp, "unzip");

  try {
    const zip = await downloadZip(job);
    await writeFile(zipPath, zip);

    // Unzip with ditto (built-in on macOS).
    await rm(unzipDir, { recursive: true, force: true });
    await run("mkdir", ["-p", unzipDir], { cwd: tmp });
    await run("ditto", ["-x", "-k", zipPath, unzipDir], {
      cwd: tmp,
      onLine: () => {},
    });

    let projectName = job.request.projectName;

    // Auto-detect project name from unzipped contents: find the .xcodeproj and derive the name.
    let contents = [];
    try { contents = readdirSync(unzipDir); } catch (_) {}
    const xcodeprojEntry = contents.find((e) => e.endsWith(".xcodeproj"));
    if (xcodeprojEntry) {
      const detected = xcodeprojEntry.replace(/\.xcodeproj$/, "");
      if (detected && detected !== projectName) {
        projectName = detected;
      }
    }

    const projDir = join(unzipDir, projectName);
    const xcodeproj = join(unzipDir, `${projectName}.xcodeproj`);

    if (!existsSync(xcodeproj)) {
      const msg = `Xcode project not found.\nExpected: ${projectName}.xcodeproj\nUnzip contains: ${contents.join(", ") || "(empty)"}`;
      await updateJob(job.id, { status: "failed", error: msg, logs: [msg] });
      return;
    }

    const logs = [];
    let lastFlushAt = Date.now();
    const flush = async (force = false) => {
      if (!logs.length) return;
      if (!force && Date.now() - lastFlushAt < 1000) return;
      const chunk = logs.splice(0, logs.length);
      lastFlushAt = Date.now();
      await updateJob(job.id, { logs: chunk });
    };

    const derivedDataPath = join(tmp, "DerivedData");
    const baseArgs = [
      "-project",
      xcodeproj,
      "-scheme",
      projectName,
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      derivedDataPath,
      "build",
      // Don't require signing for simulator builds.
      "CODE_SIGNING_ALLOWED=NO",
      "CODE_SIGNING_REQUIRED=NO",
      'CODE_SIGN_IDENTITY=""',
    ];

    const { path: xcodebuildPath, tried } = getXcodebuildPath();
    logs.push(xcodebuildPath === "xcodebuild" ? `xcodebuild not found. Tried: ${tried.join(", ")}` : `Using: ${xcodebuildPath}`);
    logs.push(`xcodebuild ${baseArgs.join(" ")}`);
    await flush(true);

    let result;
    const runOpts = {
      cwd: unzipDir,
      onLine: (line) => {
        logs.push(line);
        flush(false).catch(() => {});
      },
    };
    try {
      // Run via shell so the OS executes xcodebuild in a normal context (avoids ENOENT when path exists but direct spawn is blocked, e.g. quarantine or sandbox).
      if (xcodebuildPath !== "xcodebuild" && xcodebuildPath.includes("/")) {
        result = await run("/bin/sh", ["-c", 'exec "$@"', "sh", xcodebuildPath, ...baseArgs], runOpts);
      } else {
        result = await run(xcodebuildPath, baseArgs, runOpts);
      }
    } catch (spawnErr) {
      const msg = spawnErr?.code === "ENOENT"
        ? `xcodebuild not found. Tried: ${tried.join(", ")}. Install Xcode or run: xcode-select -s /Applications/Xcode.app/Contents/Developer`
        : (spawnErr?.message || String(spawnErr));
      logs.push(`Runner error: ${msg}`);
      await flush(true);
      await updateJob(job.id, { status: "failed", error: msg, logs: [] });
      return;
    }

    await flush(true);

    if (result.code === 0) {
      await updateJob(job.id, { status: "succeeded", exitCode: 0, logs: ["✅ Build succeeded"] });
      // Start simulator and stream frames to the web app (fire-and-forget).
      const appPath = join(
        derivedDataPath,
        "Build",
        "Products",
        "Debug-iphonesimulator",
        `${projectName}.app`
      );
      const bundleId = job.request.bundleId || "com.vibetree.app";
      const projectId = job.request.projectId;
      // Await boot+install+launch so tmp is still valid; screenshot loop runs in background.
      await runSimulatorStream(projectId, appPath, bundleId);
    } else {
      const allOutput = (result.out || "") + "\n" + (result.err || "");
      // Capture Swift compiler errors: file.swift:line:col: error: or file.swift:line: error:
      const swiftErrorRe = /\.swift:\d+(?::\d+)?:\s*error:/;
      const errorLines = allOutput
        .split(/\r?\n/)
        .filter((l) => swiftErrorRe.test(l) || (/\.swift/.test(l) && /error:/.test(l)))
        .map((l) => l.trim())
        .filter(Boolean);
      const uniqueErrors = [...new Set(errorLines)].slice(0, 20);

      await updateJob(job.id, {
        status: "failed",
        exitCode: result.code,
        error: "xcodebuild failed",
        logs: ["❌ Build failed (see logs above)"],
        ...(uniqueErrors.length > 0 ? { compilerErrors: uniqueErrors } : {}),
      });
    }
  } catch (e) {
    await updateJob(job.id, {
      status: "failed",
      error: e instanceof Error ? e.message : "Runner error",
      logs: [`Runner error: ${e instanceof Error ? e.message : String(e)}`],
    });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`Mac runner ${RUNNER_ID} polling ${SERVER_URL}`);
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await sleep(1500);
        continue;
      }
      await validateJob(job);
    } catch (e) {
      console.error(e);
      await sleep(2000);
    }
  }
}

main();

