import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

/**
 * GET /api/dev/activity
 * Returns git status (modified/added/deleted files) for the dev activity widget.
 * Only available in development.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const root = path.resolve(process.cwd());
    const output = execSync("git status --porcelain -z", { cwd: root, encoding: "utf-8" });
    const entries = output.split("\0").filter(Boolean);

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];

    for (const entry of entries) {
      const x = entry[0] ?? " ";
      const y = entry[1] ?? " ";
      const file = entry.slice(3).trim().replace(/^"(.*)"$/, "$1");
      const isDeleted = x === "D" || y === "D";
      const isAdded = x === "A" || y === "A" || x === "?" || (x === " " && y === "?");
      if (isDeleted) deleted.push(file);
      else if (isAdded) added.push(file);
      else modified.push(file);
    }

    return NextResponse.json({
      modified,
      added,
      deleted,
      total: modified.length + added.length + deleted.length,
    });
  } catch {
    return NextResponse.json({ modified: [], added: [], deleted: [], total: 0 });
  }
}
