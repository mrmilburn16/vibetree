/**
 * Mock LLM adapter — returns valid { content, editedFiles } without calling any API.
 * Used when ANTHROPIC_API_KEY is unset or for pre-LLM testing.
 */

export interface LLMResponse {
  content: string;
  editedFiles: string[];
}

const MOCK_RESPONSES: LLMResponse[] = [
  {
    content: "Created a fitness tracking app with activity rings.",
    editedFiles: [
      "Models/Workout.swift",
      "Models/Exercise.swift",
      "Views/ActivityRingsView.swift",
      "ContentView.swift",
    ],
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

/** Simulated delay (ms) to mimic API latency */
const MOCK_DELAY_MS = 1200 + Math.random() * 1200;

/**
 * Get a mock assistant response. Optionally pass message/model for future fixture rules.
 */
export async function mockGetResponse(
  _message: string,
  _model?: string
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const mock =
    MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  return { content: mock.content, editedFiles: [...mock.editedFiles] };
}
