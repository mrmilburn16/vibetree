import { NextRequest, NextResponse } from "next/server";
import {
  loadStatus,
  runHealthChecks,
  setServiceOverride,
  setSubServiceOverride,
  setGlobalMessage,
  getEffectiveStatus,
  getEffectiveSubStatus,
  type ServiceStatusValue,
} from "@/lib/serviceStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = loadStatus();
  const services = data.services.map((s) => ({
    ...s,
    effectiveStatus: getEffectiveStatus(s),
    subServices: s.subServices?.map((sub) => ({
      ...sub,
      effectiveStatus: getEffectiveSubStatus(sub),
    })),
  }));
  return NextResponse.json({ services, globalMessage: data.globalMessage });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "override") {
      const { serviceId, override, overrideMessage } = body;
      if (!serviceId) {
        return NextResponse.json({ error: "Missing serviceId" }, { status: 400 });
      }
      const validStatuses: Array<ServiceStatusValue | null> = ["operational", "degraded", "down", null];
      if (!validStatuses.includes(override)) {
        return NextResponse.json({ error: "Invalid override value" }, { status: 400 });
      }
      const service = setServiceOverride(
        serviceId,
        override ?? null,
        typeof overrideMessage === "string" ? overrideMessage : null,
      );
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
      return NextResponse.json({ service: { ...service, effectiveStatus: getEffectiveStatus(service) } });
    }

    if (action === "subOverride") {
      const { serviceId, subServiceId, override } = body;
      if (!serviceId || !subServiceId) {
        return NextResponse.json({ error: "Missing serviceId or subServiceId" }, { status: 400 });
      }
      const validStatuses: Array<ServiceStatusValue | null> = ["operational", "degraded", "down", null];
      if (!validStatuses.includes(override)) {
        return NextResponse.json({ error: "Invalid override value" }, { status: 400 });
      }
      const sub = setSubServiceOverride(serviceId, subServiceId, override ?? null);
      if (!sub) {
        return NextResponse.json({ error: "Sub-service not found" }, { status: 404 });
      }
      return NextResponse.json({ subService: { ...sub, effectiveStatus: getEffectiveSubStatus(sub) } });
    }

    if (action === "globalMessage") {
      const msg = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
      setGlobalMessage(msg);
      return NextResponse.json({ globalMessage: msg });
    }

    if (action === "checkAll" || action === "checkOne") {
      const proto = req.headers.get("x-forwarded-proto") ?? "http";
      const host = req.headers.get("host") ?? "localhost:3001";
      const baseUrl = `${proto}://${host}`;
      const data = await runHealthChecks(baseUrl);
      const services = data.services.map((s) => ({
        ...s,
        effectiveStatus: getEffectiveStatus(s),
        subServices: s.subServices?.map((sub) => ({
          ...sub,
          effectiveStatus: getEffectiveSubStatus(sub),
        })),
      }));
      return NextResponse.json({ services, globalMessage: data.globalMessage });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
