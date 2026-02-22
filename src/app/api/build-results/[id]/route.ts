import { updateBuildResult } from "@/lib/buildResultsLog";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: { userNotes?: string; userDesignScore?: number | null; userFunctionalScore?: number | null; userImagePath?: string | null } = {};

  if (typeof body.userNotes === "string") updates.userNotes = body.userNotes;
  if (body.userDesignScore === null || (typeof body.userDesignScore === "number" && body.userDesignScore >= 1 && body.userDesignScore <= 5)) {
    updates.userDesignScore = body.userDesignScore;
  }
  if (body.userFunctionalScore === null || (typeof body.userFunctionalScore === "number" && body.userFunctionalScore >= 1 && body.userFunctionalScore <= 5)) {
    updates.userFunctionalScore = body.userFunctionalScore;
  }
  if (body.userImagePath === null || (typeof body.userImagePath === "string" && /^br_[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(body.userImagePath))) {
    updates.userImagePath = body.userImagePath;
  }

  const result = updateBuildResult(id, updates);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ result });
}
