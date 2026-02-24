import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type ActionId = "share" | "follow_x" | "follow_threads" | "like" | "discord" | "newsletter" | "invite";

const ACTION_POINTS: Record<ActionId, number> = {
  share: 300,
  follow_x: 200,
  follow_threads: 150,
  like: 100,
  discord: 200,
  newsletter: 150,
  invite: 500,
};

const VALID_ACTIONS = new Set<ActionId>(Object.keys(ACTION_POINTS) as ActionId[]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; action?: string };
    const token = (body.token ?? "").trim();
    const action = (body.action ?? "").trim() as ActionId;

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection("waitlist").doc(token);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Waitlist entry not found." }, { status: 404 });
    }

    const data = snap.data()!;
    const completedActions: string[] = data.completedActions ?? [];

    // Idempotent: skip if already completed
    if (completedActions.includes(action)) {
      const currentPoints = data.points as number;
      const rank = await getRank(token, currentPoints);
      return NextResponse.json({
        points: currentPoints,
        completedActions,
        position: rank,
        alreadyDone: true,
      });
    }

    const earned = ACTION_POINTS[action];
    await docRef.update({
      points: FieldValue.increment(earned),
      completedActions: FieldValue.arrayUnion(action),
    });

    const updatedSnap = await docRef.get();
    const updatedData = updatedSnap.data()!;
    const newPoints = updatedData.points as number;
    const rank = await getRank(token, newPoints);

    return NextResponse.json({
      points: newPoints,
      completedActions: updatedData.completedActions as string[],
      position: rank,
      earned,
    });
  } catch (err) {
    console.error("[waitlist/action]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}

async function getRank(token: string, points: number): Promise<number> {
  const db = getAdminDb();
  // Count how many entries have strictly more points (rank = that count + 1)
  const higherSnap = await db
    .collection("waitlist")
    .where("points", ">", points)
    .count()
    .get();
  const higher = higherSnap.data().count;

  // For ties, count entries with same points but earlier position
  const snap = await db.collection("waitlist").doc(token).get();
  const myPosition = (snap.data()?.position as number) ?? 0;
  const tieSnap = await db
    .collection("waitlist")
    .where("points", "==", points)
    .where("position", "<", myPosition)
    .count()
    .get();
  const tiesBefore = tieSnap.data().count;

  return higher + tiesBefore + 1;
}
