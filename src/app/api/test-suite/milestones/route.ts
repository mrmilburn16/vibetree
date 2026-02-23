import { getAllMilestones, getMilestonePrompts, MILESTONE_IDS, type MilestoneId } from "@/lib/milestonePrompts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    if (!MILESTONE_IDS.includes(id as MilestoneId)) {
      return Response.json({ error: `Unknown milestone: ${id}` }, { status: 400 });
    }
    const config = getMilestonePrompts(id as MilestoneId);
    return Response.json({ milestone: config });
  }

  const milestones = getAllMilestones();
  return Response.json({ milestones });
}
