import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { getBuildResult, updateBuildResult } from "@/lib/buildResultsLog";

const IMAGES_DIR = join(process.cwd(), "data", "build-results-images");

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function getExt(file: File): string {
  const ext = MIME_EXT[file.type];
  if (ext) return ext;
  const name = file.name?.toLowerCase() ?? "";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  return "png";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = getBuildResult(id);
  if (!result?.userImagePath) {
    return new Response(null, { status: 404 });
  }
  const path = join(IMAGES_DIR, result.userImagePath);
  if (!existsSync(path)) {
    return new Response(null, { status: 404 });
  }
  const buf = readFileSync(path);
  const ext = result.userImagePath.split(".").pop()?.toLowerCase() ?? "png";
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return new Response(buf, {
    headers: { "Content-Type": contentType },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = getBuildResult(id);
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  let file: File;
  try {
    const formData = await request.formData();
    file = formData.get("image") as File;
    if (!file || !(file instanceof File) || !file.size) {
      return Response.json({ error: "Missing or empty image file" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }
  const ext = getExt(file);
  const filename = `${id}.${ext}`;
  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }
  const path = join(IMAGES_DIR, filename);
  const bytes = new Uint8Array(await file.arrayBuffer());
  writeFileSync(path, Buffer.from(bytes), "binary");
  updateBuildResult(id, { userImagePath: filename });
  return Response.json({ ok: true, userImagePath: filename });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = getBuildResult(id);
  if (!result?.userImagePath) {
    return new Response(null, { status: 404 });
  }
  const path = join(IMAGES_DIR, result.userImagePath);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
  updateBuildResult(id, { userImagePath: null });
  return Response.json({ ok: true });
}
