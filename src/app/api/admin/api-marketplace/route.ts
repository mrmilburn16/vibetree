import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import {
  getApiMarketplaceEntries,
  setApiMarketplaceEnabled,
} from "@/lib/apiMarketplace";

export const dynamic = "force-dynamic";

/** GET: list all API marketplace entries (admin only). */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = getApiMarketplaceEntries();
  return NextResponse.json({ entries });
}

/** PATCH: update enabled state for an entry (admin only). Body: { id: string, enabled: boolean }. */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined;
  if (!id || enabled === undefined) {
    return NextResponse.json(
      { error: "Body must include id (string) and enabled (boolean)" },
      { status: 400 }
    );
  }
  setApiMarketplaceEnabled(id, enabled);
  const entries = getApiMarketplaceEntries();
  const updated = entries.find((e) => e.id === id);
  return NextResponse.json({ ok: true, entry: updated });
}
