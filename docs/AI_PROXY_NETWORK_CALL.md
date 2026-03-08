# AI proxy: correct network call in generated apps

Generated apps that use AI (coach, chat, workout plan, etc.) must call the **VibeTree proxy** only. They must **not** call OpenAI or Claude APIs directly or use any API key in the app.

## What to check in generated code (e.g. AppState.swift)

Search for the **network call** that triggers the AI. It should look like this:

### Correct pattern (proxy)

- **URL:** Built from placeholders, ending with `/api/proxy/ai`.
  - Constants: `private let kApiBaseURL = "__VIBETREE_API_BASE_URL__"` and `private let kAppToken = "__VIBETREE_APP_TOKEN__"`.
  - Request URL: `kApiBaseURL + "/api/proxy/ai"` (or `URL(string: kApiBaseURL + "/api/proxy/ai")`).
- **Method:** `POST`.
- **Headers:** `Content-Type: application/json` and **`X-App-Token: kAppToken`** (required).
- **Body (JSON):** `{ "messages": [ { "role": "user", "content": "..." } ], "systemPrompt": "...", "userId": "<device-or-user-id>" }`.
- **Response:** Decode `{ "response": "<string>" }`. If decode fails, show the **raw response string** to the user instead of "Could not parse workout plan" or similar.

Example (Swift):

```swift
private let kApiBaseURL = "__VIBETREE_API_BASE_URL__"
private let kAppToken = "__VIBETREE_APP_TOKEN__"

// URL must be proxy, not OpenAI/Claude
guard let url = URL(string: kApiBaseURL + "/api/proxy/ai") else { ... }
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue(kAppToken, forHTTPHeaderField: "X-App-Token")
request.httpBody = try JSONSerialization.data(withJSONObject: [
  "messages": messages,
  "systemPrompt": systemPrompt,
  "userId": userId
])
let (data, _) = try await URLSession.shared.data(for: request)
// Decode { "response": "..." }; on failure show String(data: data, encoding: .utf8) ?? ""
```

### Wrong patterns (fix these)

1. **Direct OpenAI/Claude:** Any URL like `https://api.openai.com/...`, `https://api.anthropic.com/...`, or use of an API key in Swift (e.g. `Authorization: Bearer sk-...`). → Must use proxy URL and `X-App-Token` only.
2. **Hardcoded or empty base URL:** e.g. `let baseURL = "https://your-backend.com"` or `""`. → Must use the literal `"__VIBETREE_API_BASE_URL__"` so the build system can replace it.
3. **Missing X-App-Token:** Request to proxy without `request.setValue(kAppToken, forHTTPHeaderField: "X-App-Token")`. → Proxy returns 401 without it.
4. **"Could not parse workout plan" (or similar) on decode failure:** Custom JSON (e.g. workout plan) decode fails and the app shows an error. → On any decode failure, show the raw response string to the user instead.

## "Could not parse workout plan" specifically

That message usually means the app **is** calling the proxy (or some API) but then:

- Tries to decode the response into a custom type (e.g. `WorkoutPlan`).
- When `JSONDecoder().decode(WorkoutPlan.self, from: data)` throws, it shows "Could not parse workout plan." instead of falling back to the raw text.

Fix: after decoding the proxy’s `{ "response": "..." }`, if you then decode the inner content (e.g. workout plan JSON) and that fails, assign the raw `response` string to the UI instead of showing an error. The skill instructs the model to do this; if the generated app still doesn’t, the anti-pattern and canonical code were updated so future builds should follow this behavior.
