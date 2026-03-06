import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectFromFirestore, type ProjectDoc } from "@/lib/projectsFirestore";
import type { SessionUser } from "@/lib/auth";

export type ProjectAuthResult =
  | { user: SessionUser; project: ProjectDoc }
  | NextResponse;

/**
 * Require an authenticated user and project ownership.
 * Use in project [id] API routes. Returns 401 if no session, 404 if project not found or not owned by user.
 */
export async function requireProjectAuth(
  request: Request,
  projectId: string
): Promise<ProjectAuthResult> {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const project = await getProjectFromFirestore(projectId, user.uid);
  if (!project) {
    const anyProject = await getProjectFromFirestore(projectId);
    if (anyProject) {
      console.warn("[projectAuth] 404: project exists in Firestore but userId mismatch", {
        projectId,
        requestUserId: user.uid,
        docUserId: anyProject.userId,
      });
    } else {
      console.warn("[projectAuth] 404: project does not exist in Firestore", { projectId, requestUserId: user.uid });
    }
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return { user, project };
}
