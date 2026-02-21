/**
 * Mock LLM adapter — returns valid { content, editedFiles } without calling any API.
 * Used when ANTHROPIC_API_KEY is unset or for pre-LLM testing.
 */

export interface ParsedFile {
  path: string;
  content: string;
}

export interface LLMResponse {
  content: string;
  editedFiles: string[];
  /** When present (e.g. from structured Claude response), route can persist these files. */
  parsedFiles?: ParsedFile[];
  /** Token usage from the API (real LLM only). Used to show cost after build. */
  usage?: { input_tokens: number; output_tokens: number };
}

const MOCK_APP_JS = `import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello from Vibetree</Text>
      <Text style={styles.subtitle}>Built in the editor</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#e0e0e0",
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    color: "#888",
    fontSize: 16,
    marginTop: 8,
  },
});
`;

const MOCK_RESPONSES_STANDARD: LLMResponse[] = [
  {
    content: "Created a fitness tracking app with activity rings.",
    editedFiles: ["App.js"],
    parsedFiles: [{ path: "App.js", content: MOCK_APP_JS }],
  },
  {
    content: "I've added a todo list with categories and due dates.",
    editedFiles: ["App.js"],
    parsedFiles: [{ path: "App.js", content: MOCK_APP_JS }],
  },
  {
    content: "Built a simple habit tracker with daily check-ins.",
    editedFiles: ["App.js"],
    parsedFiles: [{ path: "App.js", content: MOCK_APP_JS }],
  },
];

const MOCK_APP_SWIFT = `import SwiftUI

@main
struct VibetreeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`;

const MOCK_CONTENT_VIEW_SWIFT = `import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Hello from Vibetree (Pro)")
                .font(.title)
            Text("Native SwiftUI")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
`;

const MOCK_RESPONSES_PRO: LLMResponse[] = [
  {
    content: "Created a native SwiftUI app.",
    editedFiles: ["App.swift", "ContentView.swift"],
    parsedFiles: [
      { path: "App.swift", content: MOCK_APP_SWIFT },
      { path: "ContentView.swift", content: MOCK_CONTENT_VIEW_SWIFT },
    ],
  },
  {
    content: "Built a SwiftUI screen with a simple layout.",
    editedFiles: ["App.swift", "ContentView.swift"],
    parsedFiles: [
      { path: "App.swift", content: MOCK_APP_SWIFT },
      { path: "ContentView.swift", content: MOCK_CONTENT_VIEW_SWIFT },
    ],
  },
];

/** Simulated delay (ms) to mimic API latency */
const MOCK_DELAY_MS = 1200 + Math.random() * 1200;

/**
 * Get a mock assistant response. When projectType is "pro", returns Swift/SwiftUI files; otherwise Expo.
 */
export async function mockGetResponse(
  _message: string,
  _model?: string,
  projectType: "standard" | "pro" = "standard"
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
  const pool = projectType === "pro" ? MOCK_RESPONSES_PRO : MOCK_RESPONSES_STANDARD;
  const mock = pool[Math.floor(Math.random() * pool.length)];
  return {
    content: mock.content,
    editedFiles: [...mock.editedFiles],
    parsedFiles: mock.parsedFiles ? [...mock.parsedFiles] : undefined,
  };
}
