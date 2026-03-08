/**
 * Shared error pattern classification for builds dashboard and test-suite.
 * Known patterns (e.g. view type-check timeout, foregroundStyle Color) can be
 * shown with a category label on the builds dashboard.
 *
 * This file must be safe to import from client components. It does NOT import
 * buildResultsLog or firebaseAdmin so it does not pull firebase-admin into the client bundle.
 */

/** Strip file:line prefix from a compiler error line. Must match buildResultsLog.normalizeCompilerErrorForGrouping. */
function normalizeErrorForMatching(line: string): string {
  return line.replace(/\S+\.swift:\d+(:\d+)?:\s*/, "").trim();
}

/** Known patterns we explicitly track on the builds dashboard (subset of test-suite ERROR_PATTERNS). */
const KNOWN_PATTERNS_FOR_BUILDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /unable to type-check this expression in reasonable time/i, label: "View body type-check timeout" },
  { pattern: /cannot convert.*(Color|HierarchicalShapeStyle)/i, label: "ForegroundStyle Color / HierarchicalShapeStyle" },
  { pattern: /HierarchicalShapeStyle.*Color|Color.*HierarchicalShapeStyle/i, label: "ForegroundStyle Color / HierarchicalShapeStyle" },
];

/**
 * Returns a short label for known compiler error patterns, or null for "other".
 * Used on the builds dashboard to mark known patterns (status tracking is per normalized error).
 */
export function getErrorCategoryLabel(errorLine: string): string | null {
  const normalized = normalizeErrorForMatching(errorLine);
  for (const { pattern, label } of KNOWN_PATTERNS_FOR_BUILDS) {
    if (pattern.test(normalized)) return label;
  }
  return null;
}
