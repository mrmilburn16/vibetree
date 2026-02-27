/**
 * In-memory + disk-backed store for the latest simulator frame per project.
 * Used so the Mac runner can POST frames and the preview pane can GET the latest image.
 * Persisted to disk so the preview survives page refresh and server restarts.
 */

import fs from "fs";
import path from "path";

const g = globalThis as unknown as {
  __simulatorFrames?: Map<string, { buffer: Buffer; updatedAt: number }>;
};
if (!g.__simulatorFrames) g.__simulatorFrames = new Map();
const frames = g.__simulatorFrames;

const CACHE_DIR = path.join(process.cwd(), ".vibetree-cache", "simulator-frames");

function safeId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function framePath(projectId: string): { png: string; meta: string } {
  const base = path.join(CACHE_DIR, safeId(projectId));
  return { png: `${base}.png`, meta: `${base}.meta.json` };
}

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

export function setSimulatorFrame(projectId: string, buffer: Buffer): void {
  const updatedAt = Date.now();
  const entry = { buffer: Buffer.from(buffer), updatedAt };
  frames.set(projectId, entry);
  try {
    ensureCacheDir();
    const { png, meta } = framePath(projectId);
    fs.writeFileSync(png, entry.buffer);
    fs.writeFileSync(meta, JSON.stringify({ updatedAt }), "utf-8");
  } catch {
    // disk write failure is non-fatal
  }
}

export function getSimulatorFrame(projectId: string): { buffer: Buffer; updatedAt: number } | undefined {
  let entry = frames.get(projectId);
  if (entry) return entry;
  try {
    const { png, meta } = framePath(projectId);
    if (!fs.existsSync(png) || !fs.existsSync(meta)) return undefined;
    const buffer = fs.readFileSync(png);
    const raw = fs.readFileSync(meta, "utf-8");
    const parsed = JSON.parse(raw) as { updatedAt?: number };
    const updatedAt = typeof parsed?.updatedAt === "number" ? parsed.updatedAt : Date.now();
    entry = { buffer, updatedAt };
    frames.set(projectId, entry);
    return entry;
  } catch {
    return undefined;
  }
}

/** Clear the stored frame so the preview shows loading until a new build posts a frame. Call when project files are updated. */
export function clearSimulatorFrame(projectId: string): void {
  frames.delete(projectId);
  try {
    const { png, meta } = framePath(projectId);
    if (fs.existsSync(png)) fs.unlinkSync(png);
    if (fs.existsSync(meta)) fs.unlinkSync(meta);
  } catch {}
}
