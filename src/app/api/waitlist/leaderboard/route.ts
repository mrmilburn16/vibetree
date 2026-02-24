import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    const db = getAdminDb();
    const col = db.collection("waitlist");

    // Top 10 by points desc, ties broken by earliest position
    const topSnap = await col
      .orderBy("points", "desc")
      .orderBy("position", "asc")
      .limit(10)
      .get();

    const top10 = topSnap.docs.map((doc, i) => {
      const d = doc.data();
      const fullName = (d.name as string) || "Anonymous";
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] ?? "Anonymous";
      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]![0]}.` : "";
      return {
        rank: i + 1,
        displayName: lastInitial ? `${firstName} ${lastInitial}` : firstName,
        points: d.points as number,
      };
    });

    let userRank: { rank: number; displayName: string; points: number } | null = null;

    if (token) {
      const userSnap = await col.doc(token).get();
      if (userSnap.exists) {
        const d = userSnap.data()!;
        const points = d.points as number;
        const myPosition = d.position as number;

        const higherSnap = await col.where("points", ">", points).count().get();
        const higher = higherSnap.data().count;

        const tieSnap = await col
          .where("points", "==", points)
          .where("position", "<", myPosition)
          .count()
          .get();
        const tiesBefore = tieSnap.data().count;

        const rank = higher + tiesBefore + 1;
        const fullName = (d.name as string) || "Anonymous";
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts[0] ?? "Anonymous";
        const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]![0]}.` : "";

        userRank = {
          rank,
          displayName: lastInitial ? `${firstName} ${lastInitial}` : firstName,
          points,
        };
      }
    }

    return NextResponse.json({ top10, userRank });
  } catch (err) {
    console.error("[waitlist/leaderboard]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
