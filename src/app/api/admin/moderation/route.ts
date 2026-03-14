import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { addCredits } from "@/lib/userCreditsFirestore";

export const dynamic = "force-dynamic";

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

/** GET /api/admin/moderation?status=pending|approved|denied|all */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Firestore unavailable" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("status") ?? "pending";

  try {
    let query = db.collection("flagged_prompts").orderBy("timestamp", "desc") as FirebaseFirestore.Query;

    if (filter === "pending") {
      query = query.where("reviewed", "==", false);
    } else if (filter === "approved" || filter === "denied") {
      query = query.where("status", "==", filter);
    }
    // "all" = no filter

    const snap = await query.limit(200).get();
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId ?? "",
        userEmail: data.userEmail ?? "",
        projectId: data.projectId ?? "",
        prompt: data.prompt ?? "",
        flagReason: data.flagReason ?? "",
        timestamp: typeof data.timestamp === "number"
          ? data.timestamp
          : data.timestamp?.toMillis?.() ?? 0,
        reviewed: data.reviewed ?? false,
        status: data.status ?? "pending",
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[moderation] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch flagged prompts" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/moderation
 * Body: { id: string, action: "approve" | "deny" }
 * Approve: sets reviewed=true, status="approved"
 * Deny: sets reviewed=true, status="denied", disables project, refunds 1 credit
 */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Firestore unavailable" }, { status: 503 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const docId = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action === "approve" || body.action === "deny" ? body.action : null;

  if (!docId || !action) {
    return NextResponse.json({ error: "Body must include id and action (approve|deny)" }, { status: 400 });
  }

  try {
    const flagRef = db.collection("flagged_prompts").doc(docId);
    const flagSnap = await flagRef.get();
    if (!flagSnap.exists) {
      return NextResponse.json({ error: "Flagged prompt not found" }, { status: 404 });
    }

    const flagData = flagSnap.data()!;
    const projectId: string = flagData.projectId ?? "";
    const userId: string = flagData.userId ?? "";

    if (action === "approve") {
      await flagRef.update({ reviewed: true, status: "approved", reviewedAt: Date.now() });
      return NextResponse.json({ ok: true, action: "approved" });
    }

    // action === "deny"
    await flagRef.update({ reviewed: true, status: "denied", reviewedAt: Date.now() });

    // Disable the project
    if (projectId) {
      try {
        await db.collection("projects").doc(projectId).update({ disabled: true, disabledAt: Date.now() });
      } catch (err) {
        console.warn("[moderation] failed to disable project", projectId, err);
      }
    }

    // Refund 1 credit
    let creditResult: { ok: boolean; balanceAfter: number; error?: string } = { ok: false, balanceAfter: 0 };
    if (userId) {
      try {
        creditResult = await addCredits(userId, 1);
      } catch (err) {
        console.warn("[moderation] failed to refund credit for userId", userId, err);
      }
    }

    return NextResponse.json({
      ok: true,
      action: "denied",
      projectDisabled: !!projectId,
      creditRefunded: creditResult.ok,
      balanceAfter: creditResult.balanceAfter,
    });
  } catch (err) {
    console.error("[moderation] PATCH failed:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
