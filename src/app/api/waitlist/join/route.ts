import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { sendWaitlistWelcome } from "@/lib/email";
import { randomUUID } from "crypto";

const POINTS_SIGNUP = 100;
const POINTS_REFERRAL_BONUS = 500;

function generateReferralCode(token: string): string {
  return token.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; name?: string; ref?: string; abVariant?: "a" | "b" };
    const email = (body.email ?? "").trim().toLowerCase();
    const name = (body.name ?? "").trim();
    const refCode = (body.ref ?? "").trim().toLowerCase();
    const abVariant: "a" | "b" = body.abVariant === "b" ? "b" : "a";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const db = getAdminDb();
    const col = db.collection("waitlist");

    // Dedup: check if email already exists
    const existing = await col.where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      const doc = existing.docs[0]!;
      const data = doc.data();
      return NextResponse.json(
        {
          token: data.token as string,
          position: data.position as number,
          points: data.points as number,
          referralCode: data.referralCode as string,
          alreadyJoined: true,
        },
        { status: 200 }
      );
    }

    // Assign position: count + start offset
    const startNum = parseInt(process.env.WAITLIST_START_NUMBER ?? "400", 10);
    const countSnap = await col.count().get();
    const position = startNum + countSnap.data().count;

    const token = randomUUID();
    const referralCode = generateReferralCode(token);

    const entry = {
      token,
      email,
      name,
      referralCode,
      referredBy: refCode || null,
      position,
      points: POINTS_SIGNUP,
      completedActions: ["signup"],
      abVariant,
      createdAt: new Date(),
    };

    await col.doc(token).set(entry);

    // Award referrer bonus if valid ref code
    if (refCode) {
      const referrerSnap = await col.where("referralCode", "==", refCode).limit(1).get();
      if (!referrerSnap.empty) {
        const referrerDoc = referrerSnap.docs[0]!;
        await referrerDoc.ref.update({
          points: (referrerDoc.data().points as number) + POINTS_REFERRAL_BONUS,
        });
      }
    }

    // Send welcome email (non-blocking)
    sendWaitlistWelcome({ email, name, position, referralCode }).catch((err) =>
      console.error("[waitlist/join] Welcome email failed:", err)
    );

    return NextResponse.json({
      token,
      position,
      points: POINTS_SIGNUP,
      referralCode,
      alreadyJoined: false,
    });
  } catch (err) {
    console.error("[waitlist/join]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
