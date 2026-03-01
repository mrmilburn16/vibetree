import { sendBuildNotification, getPushStatus } from "@/lib/apns";
import { getSuggestedServerURL } from "@/lib/serverUrl";

/**
 * POST /api/push/test
 * Sends a test push notification to all registered devices.
 * Only available in development so you can verify APNs without building an app (no Claude tokens).
 */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { ok: false, message: "Test push is only available in development. Run the app with npm run dev." },
      { status: 403 }
    );
  }

  const { configured, deviceCount } = getPushStatus();
  if (!configured) {
    return Response.json(
      {
        ok: false,
        message:
          "APNs not configured. Set APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH, and APNS_BUNDLE_ID in .env.local.",
      },
      { status: 400 }
    );
  }
  if (deviceCount === 0) {
    const suggestedServerURL = getSuggestedServerURL();
    return Response.json(
      {
        ok: false,
        message: "No devices registered. Open the Vibetree Companion app on your iPhone and allow notifications.",
        suggestedServerURL: suggestedServerURL ?? undefined,
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendBuildNotification(
      "Test",
      "succeeded",
      "Sent from Vibetree — no build required.",
      { projectId: undefined }
    );
    if (result === null) {
      return Response.json({ ok: false, message: "No devices or APNs not configured." }, { status: 400 });
    }
    const { sent, failed, reasons } = result;
    if (failed > 0 && sent === 0) {
      const detail = reasons.length ? ` Apple returned: ${reasons.join("; ")}.` : "";
      return Response.json(
        {
          ok: false,
          message: `Push was rejected by Apple (${failed} device(s)).${detail} Check server logs for APNs status. If you see BadDeviceToken or Unregistered, open the Companion app again to re-register.`,
          deviceCount,
          sent,
          failed,
          reasons,
        },
        { status: 200 }
      );
    }
    if (failed > 0) {
      return Response.json({
        ok: true,
        message: `Sent to ${sent}/${deviceCount} device(s); ${failed} failed (${reasons.join(", ")}).`,
        deviceCount,
        sent,
        failed,
      });
    }
    return Response.json({
      ok: true,
      message: `Test notification delivered to ${sent} device(s).`,
      deviceCount,
      sent,
    });
  } catch (err) {
    console.error("[push/test] Error sending test push:", err);
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : "Failed to send push." },
      { status: 500 }
    );
  }
}
