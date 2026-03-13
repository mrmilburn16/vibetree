import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import {
  getBuildCache,
  setBuildCache,
  clearBuildCache,
  getBuildCacheSize,
  getBuildCacheEntries,
  hashString,
  type CachedBuildResult,
} from "@/lib/buildCache";

export const dynamic = "force-dynamic";

/** GET /api/admin/build-cache?promptHash=xxx — cache lookup or stats */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const promptHash = searchParams.get("promptHash");

  if (!promptHash) {
    return NextResponse.json({
      size: getBuildCacheSize(),
      entries: getBuildCacheEntries(),
    });
  }

  const cached = getBuildCache(promptHash);
  if (!cached) {
    console.log(`[BuildCache] MISS: ${promptHash}`);
    return NextResponse.json({ cached: null }, { status: 404 });
  }

  console.log(`[BuildCache] HIT: ${promptHash}`);
  return NextResponse.json({ cached });
}

/** POST /api/admin/build-cache — store a build result */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    prompt?: string;
    result?: CachedBuildResult;
    projectFiles?: Record<string, string>;
  } | null;

  if (!body?.result || !body?.projectFiles || !body?.prompt) {
    return NextResponse.json(
      { error: "Missing required fields: prompt, result, projectFiles" },
      { status: 400 },
    );
  }

  const promptHash = hashString(body.prompt.trim().toLowerCase());
  setBuildCache(promptHash, body.result, body.projectFiles);
  console.log(`[BuildCache] STORED: ${promptHash} — "${body.prompt.slice(0, 60)}"`);
  return NextResponse.json({ ok: true, promptHash });
}

/** DELETE /api/admin/build-cache — flush all entries */
export async function DELETE() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearBuildCache();
  console.log("[BuildCache] CLEARED all entries");
  return NextResponse.json({ ok: true });
}
