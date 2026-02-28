/**
 * In-memory store for vision test reports per project.
 * Used by the test suite to show auto-test results and "Fix all issues" prompt.
 */

export interface VisionTestReport {
  projectId: string;
  appName: string;
  totalActions: number;
  duration: number;
  allIssues: string[];
  featuresTestedSuccessfully: string[];
  featuresThatCouldNotBeTested: string[];
  screenshots: string[];
  overallScore: number;
  recommendation: "Pass" | "Minor issues" | "Major issues" | "Fail" | "Rebuild required";
  cursorPrompt: string;
  /** Log entries that contain error/fatal/warning/failed/crash (from session debug logs). */
  console_errors?: string[];
  total_cost_usd?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
}

const g = globalThis as unknown as { __visionTestStore?: Map<string, VisionTestReport> };
if (!g.__visionTestStore) g.__visionTestStore = new Map();
const store = g.__visionTestStore;

export function setVisionTestReport(projectId: string, report: VisionTestReport): void {
  store.set(projectId, report);
}

export function getVisionTestReport(projectId: string): VisionTestReport | undefined {
  return store.get(projectId);
}
