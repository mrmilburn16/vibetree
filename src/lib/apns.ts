import * as http2 from "http2";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import { getAllDevices } from "./deviceStore";

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

async function sendPush(
  deviceToken: string,
  payload: object,
  config: NonNullable<ReturnType<typeof getApnsConfig>>
): Promise<boolean> {
  const host = config.useSandbox ? APNS_HOST_DEV : APNS_HOST_PROD;
  const token = createToken(config);

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", () => resolve(false));

    const headers = {
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${token}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
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
        resolve(true);
      } else {
        console.warn(`[apns] Push failed (${status}): ${body}`);
        resolve(false);
      }
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

export async function sendBuildNotification(
  projectName: string,
  status: "succeeded" | "failed",
  detail?: string
): Promise<void> {
  const config = getApnsConfig();
  if (!config) {
    console.log("[apns] APNs not configured, skipping push notification");
    return;
  }

  const devices = getAllDevices();
  if (devices.length === 0) {
    console.log("[apns] No devices registered, skipping push notification");
    return;
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

  console.log(`[apns] Sending push to ${devices.length} device(s): ${title}`);

  const results = await Promise.allSettled(
    devices.map((d) => sendPush(d.deviceToken, payload, config))
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  console.log(`[apns] Sent ${sent}/${devices.length} push notifications`);
}
