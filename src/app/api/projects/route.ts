import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/projectStore";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "Untitled app";
  const project = createProject(name);
  return NextResponse.json(project);
}
