import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

/** GET /api/admin/moderation/count — returns { count: number } of unreviewed flagged prompts. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("flagged_prompts")
      .where("reviewed", "==", false)
      .count()
      .get();
    return NextResponse.json({ count: snap.data().count });
  } catch {
    // If count() aggregation not available, fall back to full query
    try {
      const db = getAdminDb();
      const snap = await db
        .collection("flagged_prompts")
        .where("reviewed", "==", false)
        .get();
      return NextResponse.json({ count: snap.size });
    } catch {
      return NextResponse.json({ count: 0 });
    }
  }
}
