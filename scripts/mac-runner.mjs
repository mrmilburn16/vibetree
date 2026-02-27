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

/** Persistent DerivedData cache per project (keyed by projectId). */
const DERIVED_DATA_CACHE_DIR = join(homedir(), ".vibetree", "derived-data-cache");

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** Load .env.local from project root so MAC_RUNNER_TOKEN, VIBETREE_SERVER_URL, XCODEBUILD_PATH work with just npm run mac-runner. */
/** Does not overwrite env vars already set (e.g. VIBETREE_SERVER_URL from npm run mac-runner:mock). */
function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      if (key in process.env && process.env[key] !== "") continue;
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch (_) {}
}

loadEnvLocal();

/** Resolve a sibling Xcode tool (devicectl, etc.) from the same Developer/usr/bin as xcodebuild. */
function getXcodeToolPath(tool) {
  const xcode = getXcodebuildPath();
  const dir = xcode.path.replace(/\/xcodebuild$/, "");
  const p = join(dir, tool);
  if (existsSync(p)) return p;
  return tool;
}

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

function parseXcdeviceList(raw) {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return { physical: [], simulators: [] };
    const ios = arr.filter((d) => {
      const plat = String(d?.platform ?? "");
      return plat.includes("iOS") || plat.includes("com.apple.platform.iphone");
    });
    const mapped = ios
      .filter((d) => d && typeof d.name === "string")
      .map((d) => {
        const plat = String(d.platform ?? "");
        const isSim =
          plat.includes("iphonesimulator") ||
          plat.includes("iOS Simulator") ||
          String(d.simulator ?? "") === "true";
        const osVersion = typeof d.operatingSystemVersion === "string" ? d.operatingSystemVersion : (typeof d.osVersion === "string" ? d.osVersion : undefined);
        const id = typeof d.identifier === "string" ? d.identifier : undefined;
        return { name: d.name, id, platform: plat, osVersion, kind: isSim ? "simulator" : "physical" };
      });
    const physical = mapped.filter((d) => d.kind === "physical");
    const simulators = mapped.filter((d) => d.kind === "simulator");
    return { physical, simulators };
  } catch (_) {
    return { physical: [], simulators: [] };
  }
}

async function reportRunnerDevices() {
  try {
    // xcdevice is the most reliable single-source list for both connected devices and simulators.
    const raw = execSync("xcrun xcdevice list --timeout 2", { encoding: "utf8", shell: true });
    const { physical, simulators } = parseXcdeviceList(raw);
    await api("/api/macos/devices/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ physical, simulators }),
    });
  } catch (_) {
    // Ignore reporting errors; build runner still works without device list.
  }
}

async function claimJob() {
  const res = await api("/api/build-jobs/claim", { method: "POST" });
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
    await run("xcrun", ["simctl", "ui", "booted", "appearance", "dark"], { onLine: () => {} });
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

/**
 * Archive and export a signed IPA from a successful build.
 * Returns the path to the .ipa file, or null on failure.
 */
async function archiveAndExportIPA(xcodebuildPath, xcodeproj, projectName, unzipDir, derivedDataPath, teamId, logs, flush) {
  const archivePath = join(derivedDataPath, `${projectName}.xcarchive`);

  logs.push("[ipa] Archiving…");
  await flush(true);

  const archiveArgs = [
    "-project", xcodeproj,
    "-scheme", projectName,
    "-archivePath", archivePath,
    "-destination", "generic/platform=iOS",
    "-derivedDataPath", derivedDataPath,
    "archive",
  ];
  if (teamId) {
    archiveArgs.push(`DEVELOPMENT_TEAM=${teamId}`);
  }

  const archiveResult = await run(
    xcodebuildPath.includes("/") ? "/bin/sh" : xcodebuildPath,
    xcodebuildPath.includes("/") ? ["-c", 'exec "$@"', "sh", xcodebuildPath, ...archiveArgs] : archiveArgs,
    { cwd: unzipDir, onLine: (line) => { logs.push(line); flush(false).catch(() => {}); } }
  );

  if (archiveResult.code !== 0) {
    logs.push("[ipa] Archive failed");
    await flush(true);
    return null;
  }

  const exportDir = join(derivedDataPath, "Export");
  const exportOptionsPath = join(unzipDir, "ExportOptions.plist");
  const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>development</string>
  <key>compileBitcode</key>
  <false/>
  ${teamId ? `<key>teamID</key><string>${teamId}</string>` : ""}
</dict>
</plist>`;

  await writeFile(exportOptionsPath, exportOptions);

  logs.push("[ipa] Exporting IPA…");
  await flush(true);

  const exportArgs = [
    "-exportArchive",
    "-archivePath", archivePath,
    "-exportPath", exportDir,
    "-exportOptionsPlist", exportOptionsPath,
  ];

  const exportResult = await run(
    xcodebuildPath.includes("/") ? "/bin/sh" : xcodebuildPath,
    xcodebuildPath.includes("/") ? ["-c", 'exec "$@"', "sh", xcodebuildPath, ...exportArgs] : exportArgs,
    { cwd: unzipDir, onLine: (line) => { logs.push(line); flush(false).catch(() => {}); } }
  );

  if (exportResult.code !== 0) {
    logs.push("[ipa] Export failed");
    await flush(true);
    return null;
  }

  const ipaFiles = readdirSync(exportDir).filter(f => f.endsWith(".ipa"));
  if (ipaFiles.length === 0) {
    logs.push("[ipa] No .ipa found in export output");
    await flush(true);
    return null;
  }

  const ipaPath = join(exportDir, ipaFiles[0]);
  logs.push(`[ipa] IPA ready: ${ipaFiles[0]}`);
  await flush(true);
  return ipaPath;
}

/**
 * Find the first connected physical iOS device via devicectl.
 * Returns { identifier, name } or null.
 */
function findConnectedDevice() {
  const devicectl = getXcodeToolPath("devicectl");
  try {
    const raw = execSync(
      `"${devicectl}" list devices --json-output /dev/stdout 2>/dev/null`,
      { encoding: "utf8", shell: true, timeout: 10000 }
    );
    // devicectl appends a human-readable table after the JSON — extract just the JSON object.
    const jsonEnd = raw.lastIndexOf("}");
    const jsonStr = jsonEnd >= 0 ? raw.slice(0, jsonEnd + 1) : raw;
    const data = JSON.parse(jsonStr);
    const devices = data?.result?.devices ?? [];
    // Filter to iPhones/iPads only (exclude Apple Watch, Apple TV, etc.)
    const iosDevices = devices.filter((d) => {
      const model = d?.hardwareProperties?.deviceType ?? d?.hardwareProperties?.productType ?? "";
      const platform = d?.hardwareProperties?.platform ?? "";
      return (
        model.includes("iPhone") ||
        model.includes("iPad") ||
        platform === "iOS" ||
        platform.includes("iphone")
      );
    });
    // Prefer wired, then tunneled, then localNetwork
    const connected =
      iosDevices.find((d) => d?.connectionProperties?.transportType === "wired") ||
      iosDevices.find((d) => d?.connectionProperties?.tunnelState === "connected") ||
      iosDevices.find((d) => d?.connectionProperties?.transportType === "localNetwork");
    if (connected) {
      return {
        identifier: connected.identifier ?? connected.hardwareProperties?.udid,
        name: connected.deviceProperties?.name ?? "Unknown",
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Install a .app bundle on a connected iOS device via devicectl.
 * Returns true on success, false on failure.
 */
async function installAppOnDevice(appPath, deviceId, bundleId, logs, flush) {
  const devicectl = getXcodeToolPath("devicectl");
  logs.push(`[install] Installing on device ${deviceId}…`);
  await flush(true);

  const result = await run(
    "/bin/sh",
    ["-c", `exec "${devicectl}" device install app --device "${deviceId}" "${appPath}"`],
    {
      cwd: "/tmp",
      onLine: (line) => {
        logs.push(line);
        flush(false).catch(() => {});
      },
    }
  );

  if (result.code !== 0) {
    logs.push(`[install] ❌ Install failed (exit ${result.code})`);
    await flush(true);
    return false;
  }

  logs.push("[install] ✅ App installed on device");
  await flush(true);

  // Auto-launch the app so the user sees it immediately
  if (bundleId) {
    logs.push(`[install] Launching ${bundleId}…`);
    await flush(true);
    try {
      const launchResult = await run(
        "/bin/sh",
        ["-c", `exec "${devicectl}" device process launch --device "${deviceId}" "${bundleId}"`],
        {
          cwd: "/tmp",
          onLine: (line) => {
            logs.push(line);
            flush(false).catch(() => {});
          },
        }
      );
      if (launchResult.code === 0) {
        logs.push("[install] ✅ App launched on device");
      } else {
        logs.push("[install] ⚠️ App installed but could not auto-launch — open it from your home screen");
      }
      await flush(true);
    } catch (_) {
      logs.push("[install] ⚠️ App installed but auto-launch failed — open it from your home screen");
      await flush(true);
    }
  }

  return true;
}

/**
 * Get or create a cached DerivedData directory for a project.
 */
function getCachedDerivedDataPath(projectId) {
  const cached = join(DERIVED_DATA_CACHE_DIR, projectId);
  try {
    execSync(`mkdir -p "${cached}"`, { shell: true });
  } catch (_) {}
  return existsSync(cached) ? cached : null;
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

    const wantIPA = job.request.outputType === "ipa";
    const wantDevice = job.request.outputType === "device";
    const teamId = job.request.developmentTeam || process.env.DEFAULT_DEVELOPMENT_TEAM || "";
    const cachedDD = getCachedDerivedDataPath(job.request.projectId);
    const derivedDataPath = cachedDD || join(tmp, "DerivedData");

    let baseArgs;
    if (wantDevice || wantIPA) {
      baseArgs = [
        "-project", xcodeproj,
        "-scheme", projectName,
        "-destination", "generic/platform=iOS",
        "-derivedDataPath", derivedDataPath,
        "build",
        "-allowProvisioningUpdates",
      ];
      if (teamId) {
        baseArgs.push(`DEVELOPMENT_TEAM=${teamId}`);
      }
    } else {
      baseArgs = [
        "-project", xcodeproj,
        "-scheme", projectName,
        "-destination", "generic/platform=iOS Simulator",
        "-derivedDataPath", derivedDataPath,
        "build",
        "CODE_SIGNING_ALLOWED=NO",
        "CODE_SIGNING_REQUIRED=NO",
        'CODE_SIGN_IDENTITY=""',
      ];
    }

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
      if (wantDevice) {
        const appPath = join(
          derivedDataPath, "Build", "Products", "Debug-iphoneos", `${projectName}.app`
        );
        const device = findConnectedDevice();
        if (!device) {
          logs.push("[install] ⚠️ No connected iOS device found — build succeeded but could not install.");
          logs.push("[install] Connect your iPhone via USB or ensure it's on the same network, then try again.");
          await flush(true);
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            logs: ["✅ Build succeeded", "⚠️ No connected device found for auto-install"],
          });
        } else {
          logs.push(`[install] Found device: ${device.name} (${device.identifier})`);
          await flush(true);
          const bundleId = job.request.bundleId || "com.vibetree.app";
          const installed = await installAppOnDevice(appPath, device.identifier, bundleId, logs, flush);
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            logs: installed
              ? ["✅ Build succeeded", `✅ Installed on ${device.name}`]
              : ["✅ Build succeeded", `⚠️ Install failed on ${device.name} — download the zip and run from Xcode instead`],
          });
        }
      } else if (wantIPA) {
        const ipaPath = await archiveAndExportIPA(
          xcodebuildPath, xcodeproj, projectName, unzipDir, derivedDataPath, teamId, logs, flush
        );
        if (ipaPath) {
          const ipaBuf = await readFile(ipaPath);
          const ipaBase64 = ipaBuf.toString("base64");
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            logs: ["✅ Build succeeded", "[ipa] IPA uploaded"],
            ipaBase64,
          });
        } else {
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            logs: ["✅ Build succeeded", "⚠️ IPA export failed (build still valid)"],
          });
        }
      } else {
        await updateJob(job.id, { status: "succeeded", exitCode: 0, logs: ["✅ Build succeeded"] });
        const appPath = join(
          derivedDataPath, "Build", "Products", "Debug-iphonesimulator", `${projectName}.app`
        );
        const bundleId = job.request.bundleId || "com.vibetree.app";
        const projectId = job.request.projectId;
        await runSimulatorStream(projectId, appPath, bundleId);
      }
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
  // Report device list periodically so the web app can offer a dropdown.
  reportRunnerDevices().catch(() => {});
  setInterval(() => {
    reportRunnerDevices().catch(() => {});
  }, 15000);
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

