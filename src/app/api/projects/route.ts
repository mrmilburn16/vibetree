import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listProjects,
  createProject,
  ensureProject,
  setProjects,
} from "@/lib/projectStore";
import {
  listProjectsFromFirestore,
  createProjectInFirestore,
  type ProjectDoc,
} from "@/lib/projectsFirestore";

function toRecord(doc: ProjectDoc): { id: string; name: string; bundleId: string; projectType: "standard" | "pro"; createdAt: number; updatedAt: number; appetizePublicKey?: string | null } {
  return {
    id: doc.id,
    name: doc.name,
    bundleId: doc.bundleId,
    projectType: doc.projectType,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    appetizePublicKey: doc.appetizePublicKey,
  };
}

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projects: fromFirestore, fromFirestore: useFirestore } = await listProjectsFromFirestore(user.uid);
  if (useFirestore) {
    setProjects(fromFirestore.map(toRecord));
  }
  const projects = listProjects().map((p) => ({
    ...p,
    projectType: p.projectType ?? "pro",
  }));
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || "Untitled app" : "Untitled app";
  const id = typeof body.id === "string" ? body.id.trim() : undefined;
  const projectType =
    body.projectType === "pro"
      ? "pro"
      : body.projectType === "standard"
        ? "standard"
        : "pro";
  const project = id ? ensureProject(id, name, projectType) : createProject(name, projectType);
  const doc: ProjectDoc = {
    id: project.id,
    name: project.name,
    bundleId: project.bundleId,
    projectType,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    userId: user.uid,
  };
  await createProjectInFirestore(doc);
  return NextResponse.json({ project: { ...project, projectType } });
}
