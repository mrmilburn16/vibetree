/**
 * In-memory store for the latest simulator frame per project.
 * Used so the Mac runner can POST frames and the preview pane can GET the latest image.
 */

const g = globalThis as unknown as {
  __simulatorFrames?: Map<string, { buffer: Buffer; updatedAt: number }>;
};
if (!g.__simulatorFrames) g.__simulatorFrames = new Map();
const frames = g.__simulatorFrames;

export function setSimulatorFrame(projectId: string, buffer: Buffer): void {
  frames.set(projectId, { buffer: Buffer.from(buffer), updatedAt: Date.now() });
}

export function getSimulatorFrame(projectId: string): { buffer: Buffer; updatedAt: number } | undefined {
  return frames.get(projectId);
}
