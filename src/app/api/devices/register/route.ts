import { registerDevice } from "@/lib/deviceStore";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const deviceToken = typeof body?.deviceToken === "string" ? body.deviceToken : "";
  if (!deviceToken) {
    return Response.json({ error: "deviceToken is required" }, { status: 400 });
  }
  const activityPushToken =
    typeof body?.activityPushToken === "string" ? body.activityPushToken : undefined;

  registerDevice(deviceToken, activityPushToken);
  console.log(`[devices] Registered device token: ${deviceToken.slice(0, 12)}…`);

  return Response.json({ ok: true });
}
