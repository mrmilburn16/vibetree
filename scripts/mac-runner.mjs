import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

/** Resolve xcodebuild path so it works when PATH doesn't include Xcode (e.g. non-interactive shell). */
function getXcodebuildPath() {
  const candidates = [];
  const home = process.env.HOME || homedir();
  if (home) candidates.push(join(home, "Downloads", "Xcode.app", "Contents", "Developer", "usr", "bin", "xcodebuild"));
  candidates.push("/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild");
  try {
    const devDir = execSync("xcode-select -p", { encoding: "utf8", shell: true }).trim();
    if (devDir) candidates.push(join(devDir, "usr", "bin", "xcodebuild"));
  } catch (_) {}
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return "xcodebuild";
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

    const projectName = job.request.projectName;
    const projDir = join(unzipDir, projectName);
    const xcodeproj = join(projDir, `${projectName}.xcodeproj`);

    const logs = [];
    let lastFlushAt = Date.now();
    const flush = async (force = false) => {
      if (!logs.length) return;
      if (!force && Date.now() - lastFlushAt < 1000) return;
      const chunk = logs.splice(0, logs.length);
      lastFlushAt = Date.now();
      await updateJob(job.id, { logs: chunk });
    };

    const baseArgs = [
      "-project",
      xcodeproj,
      "-scheme",
      projectName,
      "-destination",
      "platform=iOS Simulator,name=iPhone 15",
      "build",
      // Don't require signing for simulator builds.
      "CODE_SIGNING_ALLOWED=NO",
      "CODE_SIGNING_REQUIRED=NO",
      'CODE_SIGN_IDENTITY=""',
    ];

    const xcodebuildPath = getXcodebuildPath();
    logs.push(`xcodebuild ${baseArgs.join(" ")}`);
    await flush(true);

    let result;
    try {
      result = await run(xcodebuildPath, baseArgs, {
        cwd: projDir,
        onLine: (line) => {
          logs.push(line);
          flush(false).catch(() => {});
        },
      });
    } catch (spawnErr) {
      const msg = spawnErr?.code === "ENOENT"
        ? "xcodebuild not found. Install Xcode and run: xcode-select -s /Applications/Xcode.app/Contents/Developer"
        : (spawnErr?.message || String(spawnErr));
      logs.push(`Runner error: ${msg}`);
      await flush(true);
      await updateJob(job.id, { status: "failed", error: msg, logs: [] });
      return;
    }

    await flush(true);

    if (result.code === 0) {
      await updateJob(job.id, { status: "succeeded", exitCode: 0, logs: ["✅ Build succeeded"] });
    } else {
      await updateJob(job.id, {
        status: "failed",
        exitCode: result.code,
        error: "xcodebuild failed",
        logs: ["❌ Build failed (see logs above)"],
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

