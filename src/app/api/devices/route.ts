import { getAllDevices } from "@/lib/deviceStore";
import { getPushStatus } from "@/lib/apns";

/**
 * GET /api/devices
 * Returns device count and push status for debugging (e.g. after opening Companion app).
 */
export async function GET(request: Request) {
  const devices = getAllDevices();
  const pushStatus = getPushStatus();
  const host = request.headers.get("host") ?? "";
  const hint =
    devices.length === 0 && host
      ? ` In the Companion app Settings, set Server URL to this server (e.g. http://YOUR_MAC_IP:3001 if you're on localhost:${host}).`
      : "";
  return Response.json({
    count: devices.length,
    configured: pushStatus.configured,
    message:
      devices.length === 0
        ? `Open Vibetree Companion on your iPhone and allow notifications; it will register automatically.${hint}`
        : `${devices.length} device(s) registered.`,
  });
}
