import { NextResponse } from "next/server";
import {
  createAdminSession,
  setAdminCookie,
  clearAdminCookie,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const action = typeof body.action === "string" ? body.action : "login";

  if (action === "logout") {
    await clearAdminCookie();
    return NextResponse.json({ ok: true });
  }

  const expected = process.env.ADMIN_SECRET || "dev-secret-change-me";
  if (secret !== expected) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const token = await createAdminSession();
  await setAdminCookie(token);
  return NextResponse.json({ ok: true });
}
