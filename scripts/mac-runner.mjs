import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
/** Cache for built device .app bundles keyed by projectId + content hash (skip rebuild when source unchanged). */
const DEVICE_APP_CACHE_DIR = join(homedir(), ".vibetree", "device-app-cache");

function contentHash(zipBuffer) {
  return createHash("sha256").update(zipBuffer).digest("hex").slice(0, 16);
}

function getCachedDeviceAppPath(projectId, hash) {
  const p = join(DEVICE_APP_CACHE_DIR, projectId, `${hash}.app`);
  return existsSync(p) ? p : null;
}

function saveDeviceAppToCache(projectId, hash, appPath) {
  if (!projectId || !hash || !appPath || !existsSync(appPath)) return;
  try {
    const dir = join(DEVICE_APP_CACHE_DIR, projectId);
    execSync(`mkdir -p "${dir}"`, { encoding: "utf8" });
    const dest = join(dir, `${hash}.app`);
    execSync(`ditto "${appPath}" "${dest}"`, { encoding: "utf8" });
  } catch (e) {
    console.warn("[device-cache] Failed to save .app to cache:", e?.message || e);
  }
}

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

const rawServerUrl = process.env.VIBETREE_SERVER_URL || "http://localhost:3001";
const SERVER_URL = /^https?:\/\//i.test(rawServerUrl) ? rawServerUrl.replace(/\/$/, "") : `http://${rawServerUrl.replace(/\/$/, "")}`;
function normalizeToken(s) {
  return (s ?? "").replace(/\r\n?|\n/g, "").trim();
}
const TOKEN = normalizeToken(process.env.MAC_RUNNER_TOKEN);
const APP_TOKEN = normalizeToken(process.env.VIBETREE_APP_TOKEN);
if (APP_TOKEN) {
  console.log("[mac-runner] VIBETREE_APP_TOKEN loaded, first 4 chars:", APP_TOKEN.slice(0, 4));
} else {
  console.warn("[mac-runner] VIBETREE_APP_TOKEN not set — generated apps may get 401 from weather proxy");
}

/** Placeholders in Swift source; replaced at build time so device can reach Mac and authenticate proxy. */
const API_BASE_URL_PLACEHOLDER = "__VIBETREE_API_BASE_URL__";
const APP_TOKEN_PLACEHOLDER = "__VIBETREE_APP_TOKEN__";

/** Escape value for use inside a Swift double-quoted string literal (\\ and "). */
function escapeForSwiftString(s) {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function injectBuildSecretsInSwiftFiles(dir, baseUrl, appToken) {
  if (!dir || !existsSync(dir)) {
    console.warn("[mac-runner] injectBuildSecretsInSwiftFiles: dir missing or not found:", dir);
    return;
  }
  const normalizedUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  const rawToken = appToken ? normalizeToken(appToken) : "";
  const normalizedToken = rawToken ? escapeForSwiftString(rawToken) : "";
  let swiftFileCount = 0;
  let urlReplacedCount = 0;
  let tokenReplacedCount = 0;
  function walk(d) {
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".swift")) {
          swiftFileCount += 1;
          let content = readFileSync(full, "utf8");
          const needsUrl = normalizedUrl && content.includes(API_BASE_URL_PLACEHOLDER);
          const needsToken = normalizedToken && content.includes(APP_TOKEN_PLACEHOLDER);
          if (needsUrl || needsToken) {
            if (needsUrl) {
              content = content.split(API_BASE_URL_PLACEHOLDER).join(normalizedUrl);
              urlReplacedCount += 1;
            }
            if (needsToken) {
              content = content.split(APP_TOKEN_PLACEHOLDER).join(normalizedToken);
              tokenReplacedCount += 1;
            }
            writeFileSync(full, content);
          }
        }
      }
    } catch (err) {
      console.warn("[mac-runner] injectBuildSecretsInSwiftFiles walk error:", err?.message || err);
    }
  }
  walk(dir);
  console.log(
    "[mac-runner] injectBuildSecretsInSwiftFiles: dir=%s, Swift files=%d, __VIBETREE_API_BASE_URL__ replaced=%d, __VIBETREE_APP_TOKEN__ replaced=%d, token length=%d",
    dir,
    swiftFileCount,
    urlReplacedCount,
    tokenReplacedCount,
    rawToken.length
  );
}
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
  const url = `${SERVER_URL}/api/build-jobs/claim`;
  const res = await api("/api/build-jobs/claim", { method: "POST" });
  if (res.status === 204) return null;
  const body = await res.text();
  if (!res.ok) {
    const preview = body.slice(0, 200).replace(/\s+/g, " ");
    console.warn(
      "[mac-runner] claim failed: %s %s | url=%s | token present=%s | body preview: %s",
      res.status,
      res.statusText,
      url,
      !!TOKEN,
      preview
    );
    throw new Error(`claim failed: ${res.status} ${body}`);
  }
  const data = JSON.parse(body);
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

  const runnerHeaders = {
    Authorization: `Bearer ${TOKEN}`,
    ...(hasFiles ? { "Content-Type": "application/json" } : {}),
  };
  const res = hasFiles
    ? await fetch(`${SERVER_URL}/api/projects/${job.request.projectId}/export-xcode`, {
        method: "POST",
        headers: runnerHeaders,
        body: JSON.stringify({
          projectName: job.request.projectName,
          bundleId: job.request.bundleId,
          developmentTeam: job.request.developmentTeam || "",
          files: job.request.files,
        }),
      })
    : await fetch(`${SERVER_URL}/api/projects/${job.request.projectId}/export-xcode`, {
        headers: runnerHeaders,
      });
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

/** Known system errors from xcodebuild/devicectl. Scan stderr/stdout and return a user-facing message or null. */
const KNOWN_SYSTEM_ERRORS = [
  [/no space left on device/i, "Build failed — your Mac is out of disk space. Free up space and try again."],
  [/unable to connect to device/i, "Build failed — iPhone not detected. Check your USB connection or trust this computer on your iPhone."],
  [/code signing error/i, "Build failed — code signing issue. Check your Apple Developer team ID in settings."],
  [/\bkilled:\s*9\b|SIGKILL/i, "Build failed — process was killed, likely due to low memory on your Mac."],
  // Device lock: install failed because iPhone is locked or requires unlock/passcode
  [/\b(locked|passcode|user unlock|device (must be )?unlocked|device lock|CoreDevice.*(lock|unlock|trust)|0xE80000[0-9A-Fa-f]{2})\b/i, "Your iPhone is locked. Please unlock your iPhone and tap Install again."],
];

function getKnownSystemErrorMessage(output) {
  if (!output || typeof output !== "string") return null;
  const combined = output;
  for (const [pattern, message] of KNOWN_SYSTEM_ERRORS) {
    if (pattern.test(combined)) return message;
  }
  return null;
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
 * Zip the .app bundle and upload to Appetize; store publicKey on the project.
 * Returns { ok: true, publicKey } on success, { ok: false, error } on failure.
 */
async function uploadAppToAppetize(projectId, appPath, projectName) {
  const apiKey = process.env.APPETIZE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[Appetize] APPETIZE_API_KEY not set, skipping upload");
    return { ok: false, error: "APPETIZE_API_KEY not set" };
  }

  const zipPath = join(tmpdir(), `vibetree-appetize-${projectId}-${Date.now()}.zip`);
  try {
    const appDir = join(appPath, "..");
    const appName = projectName + ".app";
    const zipRes = await run("zip", ["-r", "-q", zipPath, appName], { cwd: appDir, onLine: () => {} });
    if (zipRes.code !== 0) {
      console.warn("[Appetize] zip failed:", zipRes.err?.slice(0, 200));
      return { ok: false, error: "zip failed" };
    }

    const zipBuf = await readFile(zipPath);
    const form = new FormData();
    form.append("file", new Blob([zipBuf]), "app.zip");
    form.append("platform", "ios");

    const uploadRes = await fetch("https://api.appetize.io/v1/apps", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
      },
      body: form,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.warn("[Appetize] upload failed:", uploadRes.status, text?.slice(0, 300));
      return { ok: false, error: `upload ${uploadRes.status}: ${text?.slice(0, 100)}` };
    }

    const data = await uploadRes.json();
    const publicKey = data?.publicKey;
    if (!publicKey) {
      console.warn("[Appetize] response missing publicKey:", data);
      return { ok: false, error: "response missing publicKey" };
    }

    const storeRes = await api(`/api/projects/${projectId}/appetize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey }),
    });
    if (!storeRes.ok) {
      console.warn("[Appetize] failed to store publicKey on server:", await storeRes.text());
      return { ok: false, error: "failed to store publicKey" };
    }

    console.log("[Appetize] Appetize upload succeeded:", publicKey);
    return { ok: true, publicKey };
  } catch (e) {
    console.warn("[Appetize] upload error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    try {
      await rm(zipPath, { force: true });
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
 * Log signing identity for the built .app (Authority, TeamIdentifier) so we can verify development vs distribution.
 * Runs: codesign -dvvv <appPath> and pushes a short summary to logs.
 */
function logSigningIdentity(appPath, logs, flush) {
  if (!existsSync(appPath)) return;
  try {
    const out = execSync(`codesign -dvvv "${appPath}" 2>&1`, { encoding: "utf8", maxBuffer: 8192 });
    const authority = (out.match(/^Authority=(.+)$/m) || [])[1]?.trim();
    const teamId = (out.match(/^TeamIdentifier=(.+)$/m) || [])[1]?.trim();
    const id = (out.match(/^Identifier=(.+)$/m) || [])[1]?.trim();
    logs.push(`[signing] Identity: ${authority ?? "unknown"} | TeamIdentifier=${teamId ?? "—"} | Identifier=${id ?? "—"}`);
    if (authority && !authority.includes("Development") && !authority.includes("Developer")) {
      logs.push("[signing] ⚠️ Not an Apple Development identity — device install may require a different trust flow (e.g. enterprise).");
    }
    flush(true).catch(() => {});
  } catch (_) {
    logs.push("[signing] Could not read codesign info");
    flush(true).catch(() => {});
  }
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
    return { ok: false, output: (result.out || "") + "\n" + (result.err || "") };
  }

  logs.push("[install] ✅ App installed on device");
  logs.push("[install] If the app doesn't appear: enable Settings → Privacy & Security → Developer Mode (iOS 16+), then go to Settings → General → VPN & Device Management and tap your developer certificate to Trust.");
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

  return { ok: true };
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
    if (job.request.outputType === "launch") {
      const logs = [];
      const flush = async (force = false) => {
        if (!logs.length) return;
        await updateJob(job.id, { logs: logs.splice(0, logs.length) });
      };
      const device = findConnectedDevice();
      if (!device) {
        await updateJob(job.id, {
          status: "failed",
          error: "No connected iOS device found. Connect your iPhone via USB and try again.",
          logs: ["[launch] No connected device found."],
        });
        return;
      }
      const bundleId = job.request.bundleId || "com.vibetree.app";
      const devicectl = getXcodeToolPath("devicectl");
      logs.push(`[launch] Launching ${bundleId} on ${device.name}…`);
      await flush(true);
      const launchResult = await run(
        "/bin/sh",
        ["-c", `exec "${devicectl}" device process launch --device "${device.identifier}" "${bundleId}"`],
        { cwd: "/tmp", onLine: (line) => { logs.push(line); flush(false).catch(() => {}); } }
      );
      if (launchResult.code === 0) {
        logs.push("[launch] ✅ App launched on device");
        await flush(true);
        await updateJob(job.id, { status: "succeeded", exitCode: 0, logs: ["✅ App launched! Check your iPhone."] });
      } else {
        const output = (launchResult.out || "") + "\n" + (launchResult.err || "");
        const isLocked = /locked|passcode|user unlock|BSErrorCodeDescription = Locked/i.test(output);
        const errorMsg = isLocked ? "Unlock your iPhone first, then try again." : "Launch failed. Unlock your iPhone and try again.";
        await updateJob(job.id, { status: "failed", error: errorMsg, logs: [...logs, `[launch] ❌ ${errorMsg}`] });
      }
      return;
    }

    const zip = await downloadZip(job);
    const wantDevice = job.request.outputType === "device";

    if (wantDevice) {
      const hash = contentHash(zip);
      const cachedAppPath = getCachedDeviceAppPath(job.request.projectId, hash);
      if (cachedAppPath) {
        const logs = [];
        const flush = async (force = false) => {
          if (!logs.length) return;
          await updateJob(job.id, { logs: logs.splice(0, logs.length) });
        };
        logs.push("[device-cache] Reusing cached device build (source unchanged), skipping xcodebuild.");
        await flush(true);
        const device = findConnectedDevice();
        if (!device) {
          logs.push("[install] ⚠️ No connected iOS device found — cached build ready but could not install.");
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            logs: ["✅ Cached build", "⚠️ No connected device found for auto-install"],
          });
        } else {
          logs.push(`[install] Found device: ${device.name} (${device.identifier})`);
          logSigningIdentity(cachedAppPath, logs, flush);
          await flush(true);
          const bundleId = job.request.bundleId || "com.vibetree.app";
          const INSTALL_TIMEOUT_MS = 60 * 1000;
          let installed;
          try {
            installed = await Promise.race([
              installAppOnDevice(cachedAppPath, device.identifier, bundleId, logs, flush),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("INSTALL_TIMEOUT")), INSTALL_TIMEOUT_MS)
              ),
            ]);
          } catch (e) {
            if (e?.message === "INSTALL_TIMEOUT") {
              await updateJob(job.id, {
                status: "failed",
                error: "Install timed out — make sure your iPhone is unlocked and connected via USB.",
                logs: [],
              });
              return;
            }
            throw e;
          }
          const installSucceeded = installed && (installed === true || installed.ok === true);
          const installOutput = installed && installed.ok === false ? installed.output : "";
          const installSystemError = getKnownSystemErrorMessage(installOutput);
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            ...(installSucceeded && { installedOnDevice: true }),
            ...(installSystemError && { error: installSystemError }),
            logs: installSucceeded
              ? ["✅ Cached build", `✅ Installed on ${device.name}`]
              : ["✅ Cached build", installSystemError || `⚠️ Install failed on ${device.name}`],
          });
        }
        return;
      }
    }

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

    // Inject Mac's server URL and app token into Swift so device can reach proxy/API and authenticate without a browser session.
    injectBuildSecretsInSwiftFiles(join(unzipDir, projectName), SERVER_URL, APP_TOKEN || process.env.VIBETREE_APP_TOKEN);

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
          try {
            const zipBuf = await readFile(zipPath);
            const hash = contentHash(zipBuf);
            saveDeviceAppToCache(job.request.projectId, hash, appPath);
          } catch (e) {
            console.warn("[device-cache] Failed to cache .app:", e?.message || e);
          }
        } else {
          logs.push(`[install] Found device: ${device.name} (${device.identifier})`);
          logSigningIdentity(appPath, logs, flush);
          await flush(true);
          const bundleId = job.request.bundleId || "com.vibetree.app";
          const INSTALL_TIMEOUT_MS = 60 * 1000;
          let installed;
          try {
            installed = await Promise.race([
              installAppOnDevice(appPath, device.identifier, bundleId, logs, flush),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("INSTALL_TIMEOUT")), INSTALL_TIMEOUT_MS)
              ),
            ]);
          } catch (e) {
            if (e?.message === "INSTALL_TIMEOUT") {
              logs.push(
                "[install] ❌ Install timed out (60s) — make sure your iPhone is unlocked and connected via USB."
              );
              await flush(true);
              await updateJob(job.id, {
                status: "failed",
                error:
                  "Install timed out — make sure your iPhone is unlocked and connected via USB.",
                logs: [],
              });
              return;
            }
            throw e;
          }
          const installSucceeded = installed && (installed === true || installed.ok === true);
          const installOutput = installed && installed.ok === false ? installed.output : "";
          const installSystemError = getKnownSystemErrorMessage(installOutput);
          await updateJob(job.id, {
            status: "succeeded",
            exitCode: 0,
            ...(installSucceeded && { installedOnDevice: true }),
            ...(installSystemError && { error: installSystemError }),
            logs: installSucceeded
              ? ["✅ Build succeeded", `✅ Installed on ${device.name}`]
              : ["✅ Build succeeded", installSystemError || `⚠️ Install failed on ${device.name} — download the zip and run from Xcode instead`],
          });
          try {
            const zipBuf = await readFile(zipPath);
            const hash = contentHash(zipBuf);
            saveDeviceAppToCache(job.request.projectId, hash, appPath);
          } catch (e) {
            console.warn("[device-cache] Failed to cache .app:", e?.message || e);
          }
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

        if (process.env.APPETIZE_ENABLED === "true") {
          const appetizeResult = await uploadAppToAppetize(projectId, appPath, projectName);
          if (appetizeResult.ok) {
            console.log("[Appetize] Appetize upload succeeded:", appetizeResult.publicKey);
          } else {
            console.warn("[Appetize] Appetize upload failed, falling back to screenshots:", appetizeResult.error);
            await runSimulatorStream(projectId, appPath, bundleId);
          }
        } else {
          console.log("[Appetize] APPETIZE_ENABLED not set, skipping upload");
        }
      }
    } else {
      const allOutput = (result.out || "") + "\n" + (result.err || "");
      const systemError = getKnownSystemErrorMessage(allOutput);
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
        error: systemError || "xcodebuild failed",
        logs: systemError ? [systemError, "❌ Build failed (see logs above)"] : ["❌ Build failed (see logs above)"],
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

async function sendHeartbeat() {
  try {
    const res = await api("/api/runner/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runnerId: RUNNER_ID, timestamp: Date.now(), status: "online" }),
    });
    if (!res.ok) console.warn("[heartbeat] Server returned", res.status);
  } catch (e) {
    console.warn("[heartbeat]", e?.message || e);
  }
}

async function main() {
  console.log(`Mac runner ${RUNNER_ID} polling ${SERVER_URL}`);
  await sendHeartbeat();
  setInterval(sendHeartbeat, 30 * 1000);
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

