import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listProjects,
  setProjects,
  setProject,
  makeDefaultBundleId,
} from "@/lib/projectStore";
import {
  listProjectsFromFirestore,
  createProjectInFirestore,
  countActiveProjectsFromFirestore,
  type ProjectDoc,
} from "@/lib/projectsFirestore";
import { hasActiveSubscription, getSubscription } from "@/lib/subscriptionFirestore";
import { getProjectLimitForPlanId, PLANS } from "@/lib/pricing";
import { isProxyOwner } from "@/lib/proxyOwnerBypass";

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
  if (projectType === "pro") {
    const allowed = await hasActiveSubscription(user.uid);
    if (!allowed) {
      return NextResponse.json(
        { error: "Pro plan requires an active subscription. Subscribe at /pricing." },
        { status: 403 }
      );
    }
  }

  // ── Project count limit ────────────────────────────────────────────────────
  const sub = await getSubscription(user.uid);
  const planId = sub?.planId ?? "free";
  const limit = getProjectLimitForPlanId(planId);
  if (limit !== null && !isProxyOwner(user.uid)) {
    const activeCount = await countActiveProjectsFromFirestore(user.uid);
    if (activeCount >= limit) {
      const planName = PLANS.find((p) => p.id === planId)?.name ?? "your current";
      return NextResponse.json(
        {
          error: "project_limit_reached",
          limit,
          planId,
          planName,
          message: `You've reached the ${limit}-app limit on your ${planName} plan. Upgrade to create more apps.`,
        },
        { status: 403 }
      );
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const projectId = id ?? `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const record = {
    id: projectId,
    name,
    bundleId: makeDefaultBundleId(projectId),
    projectType: projectType as "standard" | "pro",
    createdAt: now,
    updatedAt: now,
  };
  const doc: ProjectDoc = {
    ...record,
    userId: user.uid,
  };
  try {
    await createProjectInFirestore(doc);
  } catch (err) {
    const code = err instanceof Error && (err.message === "FIRESTORE_UNAVAILABLE" || err.message === "FIRESTORE_WRITE_FAILED")
      ? err.message
      : "FIRESTORE_WRITE_FAILED";
    console.error("[api/projects] POST createProjectInFirestore failed", { projectId: doc.id, code, error: err });
    const clientMessage =
      code === "FIRESTORE_UNAVAILABLE"
        ? "Project could not be saved: Firestore is not configured."
        : "Project could not be saved. Please try again.";
    return NextResponse.json(
      { error: clientMessage, code },
      { status: 503 }
    );
  }
  setProject(record);
  return NextResponse.json({ project: { ...record, projectType } });
}
