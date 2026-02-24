import { NextRequest, NextResponse } from "next/server";
import {
  loadAppliedRules,
  applyRule,
  toggleRule,
  deleteRule,
} from "@/lib/qa/appliedRules";

export async function GET() {
  const rules = loadAppliedRules();
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "apply") {
      const { tag, description, rule, type, affectedSkills } = body;
      if (!tag || !description || !rule || !type) {
        return NextResponse.json(
          { error: "Missing required fields: tag, description, rule, type" },
          { status: 400 }
        );
      }
      const result = applyRule({
        tag,
        description,
        rule,
        type,
        affectedSkills: affectedSkills || [],
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ rule: result.rule });
    }

    if (action === "toggle") {
      const { ruleId, active } = body;
      if (!ruleId || typeof active !== "boolean") {
        return NextResponse.json(
          { error: "Missing ruleId or active boolean" },
          { status: 400 }
        );
      }
      const updated = toggleRule(ruleId, active);
      if (!updated) {
        return NextResponse.json(
          { error: "Rule not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ rule: updated });
    }

    if (action === "delete") {
      const { ruleId } = body;
      if (!ruleId) {
        return NextResponse.json(
          { error: "Missing ruleId" },
          { status: 400 }
        );
      }
      const success = deleteRule(ruleId);
      if (!success) {
        return NextResponse.json(
          { error: "Rule not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ deleted: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
