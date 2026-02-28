import { logBuildFeedback } from "@/lib/buildFeedbackStore";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;

  if (!rating) {
    return Response.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    projectId,
    rating,
  };

  await logBuildFeedback(entry);

  return Response.json({ ok: true });
}
