/**
 * POST /api/projects/import
 * Import project from ZIP. Body: multipart/form-data with file, or JSON with base64 zip.
 * Returns created project.
 */
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createProject, updateProject } from "@/lib/projectStore";
import { setProjectFiles } from "@/lib/projectFileStore";
import { setProjectChat } from "@/lib/projectChatStore";

export async function POST(request: Request) {
  let zipBuffer: Buffer;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file in form" }, { status: 400 });
    }
    const arr = await file.arrayBuffer();
    zipBuffer = Buffer.from(arr);
  } else if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    const base64 = body?.zip ?? body?.data;
    if (typeof base64 !== "string") {
      return NextResponse.json({ error: "Expected { zip: base64string }" }, { status: 400 });
    }
    zipBuffer = Buffer.from(base64, "base64");
  } else {
    return NextResponse.json(
      { error: "Use multipart/form-data with file, or JSON with zip (base64)" },
      { status: 400 }
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return NextResponse.json({ error: "Invalid ZIP" }, { status: 400 });
  }

  const projectJson = await zip.file("project.json")?.async("string");
  if (!projectJson) {
    return NextResponse.json({ error: "ZIP missing project.json" }, { status: 400 });
  }

  let meta: { id?: string; name?: string; bundleId?: string };
  try {
    meta = JSON.parse(projectJson);
  } catch {
    return NextResponse.json({ error: "Invalid project.json" }, { status: 400 });
  }

  const project = createProject(meta.name ?? "Imported app");
  if (meta.bundleId) updateProject(project.id, { bundleId: meta.bundleId });

  const filesDir = zip.folder("files");
  if (filesDir) {
    const fileEntries: Array<{ path: string; content: string }> = [];
    filesDir.forEach((path, entry) => {
      if (!entry.dir) fileEntries.push({ path, content: "" });
    });
    for (const f of fileEntries) {
      const content = await filesDir.file(f.path)?.async("string");
      if (content) f.content = content;
    }
    const withContent = fileEntries.filter((f) => f.content);
    if (withContent.length) setProjectFiles(project.id, withContent);
  }

  const chatJson = await zip.file("chat.json")?.async("string");
  if (chatJson) {
    try {
      const parsed = JSON.parse(chatJson) as { messages?: unknown[] };
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        const messages = parsed.messages.map((m: unknown) => {
          const msg = m as Record<string, unknown>;
          return {
            id: String(msg.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
            role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: String(msg.content ?? ""),
            ...(Array.isArray(msg.editedFiles) && { editedFiles: msg.editedFiles as string[] }),
          };
        });
        await setProjectChat(project.id, messages);
      }
    } catch {
      // ignore chat parse errors
    }
  }

  return NextResponse.json(project);
}
