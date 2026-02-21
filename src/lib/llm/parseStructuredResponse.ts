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
  } catch {
    throw new Error("Invalid structured response");
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
