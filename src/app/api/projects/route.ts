import { NextResponse } from "next/server";
import { listProjects, createProject, ensureProject } from "@/lib/projectStore";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() || "Untitled app" : "Untitled app";
  const id = typeof body.id === "string" ? body.id.trim() : undefined;
  const project = id ? ensureProject(id, name) : createProject(name);
  return NextResponse.json(project);
}
