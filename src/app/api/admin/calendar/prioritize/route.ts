import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getTasks, updateTask } from "@/lib/adminCalendarStore";

const SYSTEM = `You are a project manager helping prioritize tasks for a solo founder building a tech product.
Given a list of tasks, assign each:
- priority: 1 (critical/urgent), 2 (important), 3 (normal), 4 (low), 5 (backlog)
- estimatedMinutes: realistic time estimate in minutes (multiples of 15)

Consider: urgency, dependencies between tasks, business impact, and effort.
Respond with ONLY a JSON array: [{"id":"...","priority":1,"estimatedMinutes":30}, ...]`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const taskIds: string[] | undefined = body.taskIds;
  const confirm: boolean = body.confirm === true;

  let tasks = getTasks().filter((t) => t.status !== "done");
  if (taskIds?.length) tasks = tasks.filter((t) => taskIds.includes(t.id));

  if (tasks.length === 0) {
    return NextResponse.json({ suggestions: [], message: "No tasks to prioritize" });
  }

  const taskList = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || "",
    category: t.category || "",
    currentPriority: t.priority,
    currentEstimate: t.estimatedMinutes,
  }));

  const client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
  });
  const systemBlocks = [
    { type: "text" as const, text: SYSTEM, cache_control: { type: "ephemeral" as const, ttl: "1h" as const } },
  ];
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    system: systemBlocks,
    messages: [{ role: "user", content: JSON.stringify(taskList) }],
  });

  const usage = (response as { usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }).usage;
  if (usage) {
    console.log(
      `Tokens - input: ${usage.input_tokens ?? 0}, cache_read: ${usage.cache_read_input_tokens ?? 0}, cache_creation: ${usage.cache_creation_input_tokens ?? 0}`,
    );
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let suggestions: Array<{ id: string; priority: number; estimatedMinutes: number }>;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return NextResponse.json({ error: "Failed to parse LLM response", raw: text }, { status: 500 });
  }

  if (confirm) {
    for (const s of suggestions) {
      updateTask(s.id, {
        priority: s.priority as 1 | 2 | 3 | 4 | 5,
        estimatedMinutes: s.estimatedMinutes,
        aiPrioritized: true,
        aiEstimated: true,
      });
    }
  }

  return NextResponse.json({ suggestions, confirmed: confirm });
}
