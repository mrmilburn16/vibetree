import * as http2 from "http2";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import { getAllDevices, removeDevice } from "./deviceStore";

const APNS_HOST_PROD = "https://api.push.apple.com";
const APNS_HOST_DEV = "https://api.sandbox.push.apple.com";

function getApnsConfig() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPath = process.env.APNS_KEY_PATH;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const useSandbox = process.env.APNS_SANDBOX !== "false";

  if (!keyId || !teamId || !keyPath || !bundleId) return null;

  try {
    const key = fs.readFileSync(keyPath, "utf8");
    return { keyId, teamId, key, bundleId, useSandbox };
  } catch {
    console.warn("[apns] Could not read key file at", keyPath);
    return null;
  }
}

function createToken(config: NonNullable<ReturnType<typeof getApnsConfig>>): string {
  return jwt.sign({}, config.key, {
    algorithm: "ES256",
    keyid: config.keyId,
    issuer: config.teamId,
    expiresIn: "1h",
  });
}

export type SendPushResult = { ok: true } | { ok: false; status: number; reason: string };

async function sendPush(
  deviceToken: string,
  payload: object,
  config: NonNullable<ReturnType<typeof getApnsConfig>>,
  opts?: { pushType?: "alert" | "background"; priority?: "10" | "5"; topic?: string }
): Promise<SendPushResult> {
  const host = config.useSandbox ? APNS_HOST_DEV : APNS_HOST_PROD;
  const token = createToken(config);

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      console.warn("[apns] Connection error:", (err as Error)?.message ?? err);
      resolve({ ok: false, status: 0, reason: "Connection failed" });
    });

    const pushType = opts?.pushType ?? "alert";
    const priority = opts?.priority ?? (pushType === "background" ? "5" : "10");
    const topic = opts?.topic ?? config.bundleId;

    const headers = {
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${token}`,
      "apns-topic": topic,
      "apns-push-type": pushType,
      "apns-priority": priority,
    };

    const req = client.request(headers);
    req.setEncoding("utf8");

    let status = 0;
    req.on("response", (h) => {
      status = (h[":status"] as number) || 0;
    });

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      client.close();
      if (status === 200) {
        resolve({ ok: true });
      } else {
        let reason = body;
        try {
          const parsed = JSON.parse(body) as { reason?: string };
          if (parsed?.reason) reason = parsed.reason;
        } catch {
          /* use raw body */
        }
        console.warn(`[apns] Push failed (${status}): ${reason}`);
        resolve({ ok: false, status, reason });
      }
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

export type SendBuildNotificationResult =
  | { sent: number; failed: number; reasons: string[] }
  | null;

export async function sendBuildNotification(
  projectName: string,
  status: "succeeded" | "failed",
  detail?: string
): Promise<SendBuildNotificationResult> {
  const config = getApnsConfig();
  if (!config) {
    console.log("[apns] APNs not configured, skipping push notification");
    return null;
  }

  const devices = getAllDevices();
  if (devices.length === 0) {
    console.log("[apns] No devices registered, skipping push notification");
    return null;
  }

  const title = status === "succeeded" ? "Your app is ready!" : "Build failed";
  const body = status === "succeeded"
    ? `${projectName} built successfully.${detail ? " " + detail : ""}`
    : `${projectName} build failed.${detail ? " " + detail : ""}`;

  const payload = {
    aps: {
      alert: { title, body },
      sound: "default",
      badge: status === "failed" ? 1 : 0,
    },
  };

  console.log(`[apns] Sending push to ${devices.length} device(s): ${title} (${config.useSandbox ? "sandbox" : "production"})`);

  const results = await Promise.all(
    devices.map(async (d) => {
      const result = await sendPush(d.deviceToken, payload, config, { pushType: "alert", priority: "10" });
      if (!result.ok && (result.status === 410 || result.reason === "BadDeviceToken")) {
        removeDevice(d.deviceToken);
        console.log(`[apns] Removed invalid device token (${result.status}: ${result.reason})`);
      }
      return result;
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  const reasons = results.filter((r): r is { ok: false; status: number; reason: string } => !r.ok).map((r) => r.reason);
  console.log(`[apns] Sent ${sent}/${devices.length} push notifications${reasons.length ? `; failures: ${reasons.join(", ")}` : ""}`);
  return { sent, failed, reasons };
}

/** For status/test UI: whether APNs is configured and how many devices are registered */
export function getPushStatus(): { configured: boolean; deviceCount: number } {
  const config = getApnsConfig();
  const devices = getAllDevices();
  return {
    configured: config != null,
    deviceCount: devices.length,
  };
}

export async function sendBackgroundRefreshPush(reason: string): Promise<void> {
  const config = getApnsConfig();
  if (!config) {
    console.log("[apns] APNs not configured, skipping background refresh push");
    return;
  }

  const devices = getAllDevices();
  if (devices.length === 0) {
    console.log("[apns] No devices registered, skipping background refresh push");
    return;
  }

  const payload = {
    aps: {
      "content-available": 1,
    },
    vibetree: {
      type: "refresh",
      reason,
      ts: Date.now(),
    },
  };

  console.log(`[apns] Sending background refresh to ${devices.length} device(s): ${reason}`);
  const results = await Promise.all(
    devices.map((d) => sendPush(d.deviceToken, payload, config, { pushType: "background", priority: "5" }))
  );
  const sent = results.filter((r) => r.ok).length;
  console.log(`[apns] Sent ${sent}/${devices.length} background refresh push(es)`);
}
