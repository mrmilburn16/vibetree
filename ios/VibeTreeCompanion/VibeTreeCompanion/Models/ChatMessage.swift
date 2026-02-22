import Foundation

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let role: Role
    var text: String
    let timestamp: Date
    var editedFiles: [String]?
    var phase: String?
    var isStreaming: Bool

    enum Role: String, Equatable {
        case user
        case assistant
        case system
    }

    init(
        id: String = UUID().uuidString,
        role: Role,
        text: String,
        timestamp: Date = Date(),
        editedFiles: [String]? = nil,
        phase: String? = nil,
        isStreaming: Bool = false
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.editedFiles = editedFiles
        self.phase = phase
        self.isStreaming = isStreaming
    }

    static func userMessage(_ text: String) -> ChatMessage {
        ChatMessage(role: .user, text: text)
    }

    static func systemMessage(_ text: String, phase: String? = nil) -> ChatMessage {
        ChatMessage(role: .system, text: text, phase: phase)
    }
}

struct LLMOption: Identifiable {
    let id: String
    let label: String
    let modelValue: String
    let disabled: Bool

    static let options: [LLMOption] = [
        LLMOption(id: "opus", label: "Claude Opus 4.6", modelValue: "claude-opus-4-6-20250515", disabled: false),
        LLMOption(id: "sonnet", label: "Claude Sonnet 4.6", modelValue: "claude-sonnet-4-6-20250514", disabled: false),
        LLMOption(id: "gpt", label: "GPT 5.2", modelValue: "gpt-5.2", disabled: true)
    ]

    static var defaultOption: LLMOption { options[1] }
}
