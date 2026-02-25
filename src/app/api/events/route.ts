/**
 * POST /api/events
 * Track analytics events. Body: { name: string; properties?: Record<string, unknown> }
 */
import { NextResponse } from "next/server";
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";

const EVENTS_PATH = join(process.cwd(), "data", "events.jsonl");
const ALLOWED_NAMES = new Set([
  "page_view",
  "sign_in",
  "sign_up",
  "project_create",
  "project_delete",
  "message_sent",
  "build_started",
  "build_completed",
  "export",
]);

export async function POST(request: Request) {
  let body: { name?: string; properties?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || !ALLOWED_NAMES.has(name)) {
    return NextResponse.json(
      { error: `Invalid name. Allowed: ${[...ALLOWED_NAMES].join(", ")}` },
      { status: 400 }
    );
  }

  const properties = body.properties && typeof body.properties === "object" ? body.properties : {};
  const entry = {
    name,
    properties,
    timestamp: new Date().toISOString(),
    ua: request.headers.get("user-agent") ?? undefined,
  };

  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await appendFile(EVENTS_PATH, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    console.error("[events] Write failed:", e);
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
