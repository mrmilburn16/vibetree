/**
 * Writes generated project files to a local Expo project and starts the dev server with tunnel.
 * Used by Run on device: scan QR in Expo Go to open the app.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getProjectFiles } from "./projectFileStore";

const TEMPLATE_DIR = path.join(process.cwd(), "expo-template");
const PREVIEW_BASE = path.join(process.cwd(), ".expo-preview");

/** Paths we copy from the template (not overwritten by generated files). */
const TEMPLATE_FILES = ["package.json", "app.json", "babel.config.js"] as const;

export interface ExpoPreviewResult {
  expoUrl: string;
}

export interface ExpoPreviewError {
  error: string;
  code?: "NO_FILES" | "NO_APP" | "INSTALL_FAILED" | "EXPO_START_FAILED" | "TIMEOUT";
}

/**
 * Ensure the preview directory exists and has template files + generated files.
 * Returns the preview directory path.
 */
function ensurePreviewDir(projectId: string, files: Array<{ path: string; content: string }>): string {
  const previewDir = path.join(PREVIEW_BASE, projectId);
  if (!fs.existsSync(PREVIEW_BASE)) {
    fs.mkdirSync(PREVIEW_BASE, { recursive: true });
  }
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  // Copy template files
  for (const name of TEMPLATE_FILES) {
    const src = path.join(TEMPLATE_DIR, name);
    const dest = path.join(previewDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Write generated files (e.g. App.js, or app/App.js)
  for (const { path: filePath, content } of files) {
    if (!filePath || !content) continue;
    const dest = path.join(previewDir, filePath);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dest, content, "utf8");
  }

  return previewDir;
}

/**
 * Run npm install in dir. Resolves when done; rejects on failure or timeout.
 */
function npmInstall(dir: string, timeoutMs: number = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install"], {
      cwd: dir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed: ${stderr || code}`));
    });
    setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("npm install timeout"));
    }, timeoutMs);
  });
}

/**
 * Run expo start --tunnel and capture the first URL that looks like exp:// or a tunnel URL.
 * Resolves with that URL; rejects on timeout or process error.
 */
function startExpoAndGetUrl(projectDir: string, timeoutMs: number = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["expo", "start", "--tunnel"], {
      cwd: projectDir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const onUrl = (line: string) => {
      // Expo prints URLs like exp://u.expo.dev/... (tunnel)
      const match = line.match(/(exp:\/\/[^\s)\]\"]+)/) || line.match(/(https:\/\/[^\s)\]\"]*u\.expo\.dev[^\s)\]\"]*)/);
      if (match && !resolved) {
        resolved = true;
        // Leave process running so user can scan QR and connect with Expo Go
        resolve(match[1].trim());
      }
    };
    const flush = (buf: Buffer) => {
      const s = buf.toString();
      s.split("\n").forEach(onUrl);
    };
    child.stdout?.on("data", flush);
    child.stderr?.on("data", flush);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Expo exited before URL appeared (code=${code}, signal=${signal})`));
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill("SIGTERM");
        reject(new Error("Expo start timeout: no URL in output"));
      }
    }, timeoutMs);
  });
}

/**
 * Write project to Expo preview dir, install deps if needed, start tunnel, return URL.
 * Call from API route only (uses projectFileStore and filesystem).
 */
export async function runExpoPreview(projectId: string): Promise<ExpoPreviewResult | ExpoPreviewError> {
  const filesMap = getProjectFiles(projectId);
  if (!filesMap || Object.keys(filesMap).length === 0) {
    return { error: "Build your app first.", code: "NO_FILES" };
  }

  const files: Array<{ path: string; content: string }> = Object.entries(filesMap).map(
    (entry) => ({ path: entry[0], content: entry[1] })
  );
  const hasApp = files.some(
    (f) => f.path === "App.js" || f.path.endsWith("/App.js") || f.path === "app/App.js"
  );
  if (!hasApp) {
    return { error: "Generated app must include App.js.", code: "NO_APP" };
  }

  let previewDir: string;
  try {
    previewDir = ensurePreviewDir(projectId, files);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to write preview.", code: "EXPO_START_FAILED" };
  }

  const nodeModules = path.join(previewDir, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    try {
      await npmInstall(previewDir);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "npm install failed.",
        code: "INSTALL_FAILED",
      };
    }
  }

  try {
    const expoUrl = await startExpoAndGetUrl(previewDir);
    return { expoUrl };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Expo start failed.",
      code: "EXPO_START_FAILED",
    };
  }
}
