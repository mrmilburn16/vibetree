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
const TEMPLATE_FILES = ["package.json", "app.json", "babel.config.js", "metro.config.js"] as const;

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
function startExpoAndGetUrl(projectDir: string, timeoutMs: number = 150_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["expo", "start", "--tunnel"], {
      cwd: projectDir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const stderrLines: string[] = [];
    const onUrl = (line: string) => {
      // Expo prints URLs like exp://u.expo.dev/... or exp://192.168.x.x:8081 (tunnel or LAN)
      const expMatch = line.match(/(exp:\/\/[^\s)\]\"]+?)(?=[\s)\]\"]|$)/) || line.match(/(exp:\/\/\S+)/);
      const httpsMatch = line.match(/(https:\/\/[^\s)\]\"]*u\.expo\.dev[^\s)\]\"]*)/);
      const url = expMatch?.[1]?.trim() || httpsMatch?.[1]?.trim();
      if (url && !resolved) {
        resolved = true;
        // Leave process running so user can scan QR and connect with Expo Go
        resolve(url);
      }
    };
    const flush = (buf: Buffer) => {
      const s = buf.toString();
      s.split("\n").forEach(onUrl);
    };
    const flushStderr = (buf: Buffer) => {
      const s = buf.toString();
      stderrLines.push(...s.split("\n").map((l) => l.trim()).filter(Boolean));
      if (stderrLines.length > 30) stderrLines.splice(0, stderrLines.length - 30);
      flush(buf);
    };
    child.stdout?.on("data", flush);
    child.stderr?.on("data", flushStderr);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (!resolved) {
        resolved = true;
        const tail = stderrLines.slice(-8).join(" ").trim();
        const reason = tail
          ? `Expo exited before URL appeared (code=${code}, signal=${signal}). ${tail}`
          : `Expo exited before URL appeared (code=${code}, signal=${signal}). Run "npx expo start --tunnel" in the project directory to see the full error.`;
        reject(new Error(reason));
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill("SIGTERM");
        reject(new Error("Expo start timeout: no URL in output. The tunnel may be slow—try again, or run \"npx expo start --tunnel\" in the project folder to see the URL in the terminal."));
      }
    }, timeoutMs);
  });
}

/**
 * Write project to Expo preview dir, install deps if needed, start tunnel, return URL.
 * Call from API route only (uses projectFileStore and filesystem).
 * If clientFiles is provided (e.g. from localStorage when server store is empty), use those instead of the store.
 */
export async function runExpoPreview(
  projectId: string,
  clientFiles?: Array<{ path: string; content: string }>
): Promise<ExpoPreviewResult | ExpoPreviewError> {
  let files: Array<{ path: string; content: string }>;
  if (Array.isArray(clientFiles) && clientFiles.length > 0) {
    files = clientFiles.filter((f) => f && typeof f.path === "string" && typeof f.content === "string");
  } else {
    const filesMap = getProjectFiles(projectId);
    if (!filesMap || Object.keys(filesMap).length === 0) {
      return { error: "Build your app first.", code: "NO_FILES" };
    }
    files = Object.entries(filesMap).map((entry) => ({ path: entry[0], content: entry[1] }));
  }
  if (files.length === 0) {
    return { error: "Build your app first.", code: "NO_FILES" };
  }
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
  const ngrokPath = path.join(nodeModules, "@expo", "ngrok");
  const expoAssetPath = path.join(nodeModules, "expo-asset");
  const needsInstall =
    !fs.existsSync(nodeModules) ||
    !fs.existsSync(ngrokPath) ||
    !fs.existsSync(expoAssetPath);
  if (needsInstall) {
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
