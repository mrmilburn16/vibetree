import Foundation

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let role: Role
    var text: String
    let timestamp: Date
    var editedFiles: [String]?
    /// Paths that were already in the project (show "editing" instead of "creating" during stream).
    var editedFileIsExisting: [String]?
    var phase: String?
    var isStreaming: Bool
    var elapsedMs: TimeInterval?
    var createdAt: Date
    var discoveredFiles: [String]?

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
        editedFileIsExisting: [String]? = nil,
        phase: String? = nil,
        isStreaming: Bool = false,
        elapsedMs: TimeInterval? = nil,
        createdAt: Date = Date(),
        discoveredFiles: [String]? = nil
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.editedFiles = editedFiles
        self.editedFileIsExisting = editedFileIsExisting
        self.phase = phase
        self.isStreaming = isStreaming
        self.elapsedMs = elapsedMs
        self.createdAt = createdAt
        self.discoveredFiles = discoveredFiles
    }

    static func userMessage(_ text: String) -> ChatMessage {
        ChatMessage(role: .user, text: text, createdAt: Date())
    }

    static func systemMessage(_ text: String, phase: String? = nil) -> ChatMessage {
        ChatMessage(role: .system, text: text, phase: phase, createdAt: Date())
    }
}

struct LLMOption: Identifiable {
    let id: String
    let label: String
    let modelValue: String
    let disabled: Bool

    /// Order must match web app: Auto, Claude Opus 4.6, Claude Sonnet 4.6, GPT 5.2.
    static let options: [LLMOption] = [
        LLMOption(id: "auto", label: "Auto", modelValue: "auto", disabled: true),
        LLMOption(id: "opus-4.6", label: "Claude Opus 4.6", modelValue: "claude-opus-4-6-20250515", disabled: false),
        LLMOption(id: "sonnet-4.6", label: "Claude Sonnet 4.6", modelValue: "claude-sonnet-4-6-20250514", disabled: false),
        LLMOption(id: "gpt-5.2", label: "GPT 5.2", modelValue: "gpt-5.2", disabled: true),
    ]

    static var defaultOption: LLMOption { options[2] }
}
