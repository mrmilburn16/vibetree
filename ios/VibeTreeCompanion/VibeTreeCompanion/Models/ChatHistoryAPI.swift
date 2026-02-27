import Foundation

/// Response from GET /api/projects/:id/chat. API uses "content"; we map to ChatMessage.text.
struct ChatHistoryResponse: Codable {
    let projectId: String?
    let updatedAt: Double?
    let messages: [APIChatMessage]
}

struct APIChatMessage: Codable {
    let id: String
    let role: String
    let content: String
    let editedFiles: [String]?
}

/// Payload for POST /api/projects/:id/chat. API expects "content"; we send ChatMessage.text as content.
struct SaveChatRequest: Codable {
    let messages: [APIChatMessagePayload]
}

struct APIChatMessagePayload: Codable {
    let id: String
    let role: String
    let content: String
    let editedFiles: [String]?
}
