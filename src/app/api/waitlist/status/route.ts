import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection("waitlist").doc(token).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Waitlist entry not found." }, { status: 404 });
    }

    const data = snap.data()!;
    const points = data.points as number;
    const myPosition = data.position as number;

    // Rank = count of entries with strictly more points, + ties with earlier position + 1
    const higherSnap = await db
      .collection("waitlist")
      .where("points", ">", points)
      .count()
      .get();
    const higher = higherSnap.data().count;

    const tieSnap = await db
      .collection("waitlist")
      .where("points", "==", points)
      .where("position", "<", myPosition)
      .count()
      .get();
    const tiesBefore = tieSnap.data().count;

    const rank = higher + tiesBefore + 1;

    // Count how many people signed up using this user's referral code
    const referralCode = data.referralCode as string;
    const referralSnap = await db
      .collection("waitlist")
      .where("referredBy", "==", referralCode)
      .count()
      .get();
    const referralCount = referralSnap.data().count;

    return NextResponse.json({
      token: data.token as string,
      email: data.email as string,
      name: data.name as string,
      referralCode,
      position: rank,
      signupPosition: myPosition,
      points,
      completedActions: data.completedActions as string[],
      abVariant: data.abVariant as "a" | "b",
      referralCount,
    });
  } catch (err) {
    console.error("[waitlist/status]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
