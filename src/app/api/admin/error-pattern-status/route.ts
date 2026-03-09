import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { getErrorPatternStatuses, setErrorPatternStatus, type ErrorPatternStatusValue } from "@/lib/errorPatternStatus";

export const dynamic = "force-dynamic";

/** GET: fetch statuses. Query ?errors=... optional JSON array of normalized error strings. */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const errorsParam = url.searchParams.get("errors");
  let errors: string[] | undefined;
  if (errorsParam) {
    try {
      errors = JSON.parse(decodeURIComponent(errorsParam)) as string[];
      if (!Array.isArray(errors)) errors = undefined;
    } catch {
      // ignore
    }
  }
  const statuses = await getErrorPatternStatuses(errors);
  return NextResponse.json({ statuses });
}

/** POST: fetch statuses. Body: { errors?: string[] }. Use when the list is long to avoid URL length limits. */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const errors = Array.isArray(body?.errors) ? (body.errors as string[]).filter((e): e is string => typeof e === "string") : undefined;
  const statuses = await getErrorPatternStatuses(errors);
  return NextResponse.json({ statuses });
}

/** PATCH: set status for one error. Body: { error: string (normalized), status: "Open" | "Fixed" | "Wontfix" | "Regression" } */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const error = typeof body.error === "string" ? body.error.trim() : "";
  const status = body.status as ErrorPatternStatusValue;
  if (!error || !["Open", "Fixed", "Wontfix", "Regression"].includes(status)) {
    return NextResponse.json({ error: "Bad request: need error (string) and status (Open|Fixed|Wontfix|Regression)" }, { status: 400 });
  }
  const doc = await setErrorPatternStatus(error, status);
  if (!doc) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ status: doc });
}
