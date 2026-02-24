import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

const ALL_ACTIONS = ["signup", "share", "follow_x", "follow_threads", "like", "discord", "newsletter", "invite"] as const;

export async function GET() {
  try {
    const db = getAdminDb();
    const col = db.collection("waitlist");

    const allSnap = await col.get();
    const total = allSnap.size;

    const variantA = allSnap.docs.filter((d) => d.data().abVariant === "a");
    const variantB = allSnap.docs.filter((d) => d.data().abVariant === "b");

    function variantStats(docs: typeof allSnap.docs) {
      const count = docs.length;
      const avgPoints = count === 0 ? 0 : docs.reduce((s, d) => s + ((d.data().points as number) || 0), 0) / count;

      const actionCounts: Record<string, number> = {};
      for (const action of ALL_ACTIONS) {
        actionCounts[action] = docs.filter((d) => {
          const ca = (d.data().completedActions as string[]) ?? [];
          return ca.includes(action);
        }).length;
      }

      const actionRates: Record<string, string> = {};
      for (const action of ALL_ACTIONS) {
        const n = actionCounts[action] ?? 0;
        actionRates[action] = count === 0 ? "0%" : `${Math.round((n / count) * 100)}%`;
      }

      return { count, avgPoints: Math.round(avgPoints), actionCounts, actionRates };
    }

    return NextResponse.json({
      total,
      variantA: variantStats(variantA),
      variantB: variantStats(variantB),
    });
  } catch (err) {
    console.error("[admin/waitlist/stats]", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
