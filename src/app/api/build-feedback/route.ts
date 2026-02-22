import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const LOG_PATH = join(process.cwd(), "data", "build-feedback.jsonl");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;

  if (!rating) {
    return Response.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    projectId,
    rating,
  };

  try {
    const dir = dirname(LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    console.error("[build-feedback] Failed to write:", e);
  }

  return Response.json({ ok: true });
}
