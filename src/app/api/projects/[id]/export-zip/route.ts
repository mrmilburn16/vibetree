/**
 * GET /api/projects/[id]/export-zip
 * Returns full project as ZIP: metadata, files, chat.
 */
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getProject } from "@/lib/projectStore";
import { getProjectFiles, getProjectFilePaths } from "@/lib/projectFileStore";
import { getProjectChat } from "@/lib/projectChatStore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const project = getProject(id);
  const files = getProjectFiles(id);
  const chat = await getProjectChat(id);

  const zip = new JSZip();
  zip.file(
    "project.json",
    JSON.stringify(
      {
        id: project?.id ?? id,
        name: project?.name ?? "Untitled app",
        bundleId: project?.bundleId ?? `com.vibetree.${id}`,
        createdAt: project?.createdAt ?? Date.now(),
        updatedAt: project?.updatedAt ?? Date.now(),
      },
      null,
      2
    )
  );

  if (files) {
    const paths = getProjectFilePaths(id);
    for (const path of paths) {
      const content = files[path];
      if (content) zip.file(`files/${path}`, content);
    }
  }

  if (chat?.messages?.length) {
    zip.file("chat.json", JSON.stringify({ messages: chat.messages }, null, 2));
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="vibetree-${id.slice(0, 20)}.zip"`,
    },
  });
}
