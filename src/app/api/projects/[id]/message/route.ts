import { NextResponse } from "next/server";

const MOCK_RESPONSES = [
  {
    content: "Created a fitness tracking app with activity rings.",
    editedFiles: ["Models/Workout.swift", "Models/Exercise.swift", "Views/ActivityRingsView.swift", "ContentView.swift"],
  },
  {
    content: "I've added a todo list with categories and due dates.",
    editedFiles: ["Models/TodoItem.swift", "Views/TodoListView.swift", "ContentView.swift"],
  },
  {
    content: "Built a simple habit tracker with daily check-ins.",
    editedFiles: ["Models/Habit.swift", "Views/HabitListView.swift", "ContentView.swift"],
  },
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Mock: delay then return assistant message + build success
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1200));

  const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  return NextResponse.json({
    assistantMessage: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: mock.content,
      editedFiles: mock.editedFiles,
    },
    buildStatus: "live" as const,
  });
}
