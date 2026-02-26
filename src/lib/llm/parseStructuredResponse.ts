/**
 * Parser for structured LLM output (Option A — JSON).
 * Expects: { "summary": string, "files": [ { "path": string, "content": string } ] }.
 * Strips optional markdown code fence (```json ... ```) before parsing.
 */

export interface ParsedFile {
  path: string;
  content: string;
}

export interface StructuredResponse {
  summary: string;
  files: ParsedFile[];
}

const REQUIRED_KEYS = ["summary", "files"] as const;

function stripMarkdownJsonFence(raw: string): string {
  let s = raw.trim();
  const open = "```json";
  const close = "```";
  if (s.startsWith(open)) {
    s = s.slice(open.length);
    const end = s.indexOf(close);
    if (end !== -1) s = s.slice(0, end);
    s = s.trim();
  } else if (s.startsWith("```")) {
    s = s.slice(3);
    const end = s.indexOf(close);
    if (end !== -1) s = s.slice(0, end);
    s = s.trim();
  }
  return s;
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

/**
 * Parse raw LLM response into StructuredResponse.
 * @throws Error with message "Invalid structured response" if parsing or validation fails.
 */
export function parseStructuredResponse(raw: string): StructuredResponse {
  const trimmed = stripMarkdownJsonFence(raw);
  if (!trimmed) {
    throw new Error("Invalid structured response");
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (parseErr) {
    // Claude may have hit max_tokens and truncated the JSON mid-string.
    // Try to salvage completed files from the partial output.
    const salvaged = salvageTruncatedJSON(trimmed);
    if (salvaged) return salvaged;
    const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(`Failed to parse structured output: ${detail}`);
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid structured response");
  }

  const obj = data as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      throw new Error("Invalid structured response");
    }
  }

  if (!isNonEmptyString(obj.summary)) {
    throw new Error("Invalid structured response");
  }

  if (!Array.isArray(obj.files)) {
    throw new Error("Invalid structured response");
  }

  const files: ParsedFile[] = [];
  for (let i = 0; i < obj.files.length; i++) {
    const item = obj.files[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid structured response");
    }
    const file = item as Record<string, unknown>;
    if (!("path" in file) || !("content" in file)) {
      throw new Error("Invalid structured response");
    }
    if (!isNonEmptyString(file.path)) {
      throw new Error("Invalid structured response");
    }
    if (typeof file.content !== "string") {
      throw new Error("Invalid structured response");
    }
    files.push({ path: file.path, content: file.content });
  }

  return { summary: obj.summary, files };
}

/**
 * When Claude hits max_tokens the JSON is truncated mid-string.
 * Extract every fully-formed { "path": "…", "content": "…" } object
 * that appears before the cutoff so the build can still succeed with
 * whatever files were completed.
 */
function salvageTruncatedJSON(raw: string): StructuredResponse | null {
  // Try to extract the summary
  let summary = "App built (output was truncated).";
  const summaryMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch?.[1]) {
    try {
      summary = JSON.parse(`"${summaryMatch[1]}"`);
    } catch { /* keep default */ }
  }

  // Match complete file objects: {"path":"…","content":"…"}
  // Content can contain escaped characters, so we match conservatively.
  const files: ParsedFile[] = [];
  const filePattern = /\{\s*"path"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = filePattern.exec(raw)) !== null) {
    try {
      const path = JSON.parse(`"${match[1]}"`);
      const content = JSON.parse(`"${match[2]}"`);
      if (path && typeof content === "string") {
        files.push({ path, content });
      }
    } catch {
      // Skip malformed entries
    }
  }

  if (files.length === 0) return null;

  console.log(`[parseStructuredResponse] Salvaged ${files.length} files from truncated output (${raw.length} chars)`);
  return { summary, files };
}
