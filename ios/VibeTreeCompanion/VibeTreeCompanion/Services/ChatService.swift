import Foundation

@MainActor
final class ChatService: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isStreaming = false
    @Published var buildStatus: BuildStatus = .idle
    @Published var error: String?
    @Published var streamingFileCount = 0
    @Published var recentFiles: [String] = []

    enum BuildStatus: Equatable {
        case idle
        case building
        case ready
        case failed(String)

        var label: String {
            switch self {
            case .idle: return "Idle"
            case .building: return "Building…"
            case .ready: return "Ready"
            case .failed(let msg): return "Failed: \(msg)"
            }
        }
    }

    private var streamTask: Task<Void, Never>?
    private let projectId: String

    init(projectId: String) {
        self.projectId = projectId
    }

    func sendMessage(_ text: String, model: String, projectType: ProjectType) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 4000 else { return }
        guard !isStreaming else { return }

        messages.append(.userMessage(trimmed))
        isStreaming = true
        buildStatus = .building
        error = nil
        streamingFileCount = 0
        recentFiles = []

        let assistantId = UUID().uuidString
        messages.append(ChatMessage(
            id: assistantId,
            role: .assistant,
            text: "",
            isStreaming: true,
            createdAt: Date()
        ))

        streamTask = Task { [weak self] in
            guard let self else { return }
            await self.performStream(
                text: trimmed,
                model: model,
                projectType: projectType,
                assistantMessageId: assistantId
            )
        }
    }

    func cancel() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
        streamingFileCount = 0
        recentFiles = []
    }

    // MARK: - Streaming

    private func performStream(
        text: String,
        model: String,
        projectType: ProjectType,
        assistantMessageId: String
    ) async {
        let streamStart = Date()

        do {
            let request = try await APIService.shared.streamMessageRequest(
                projectId: projectId,
                message: text,
                model: model,
                projectType: projectType.rawValue
            )

            let (bytes, response) = try await URLSession.shared.bytes(for: request)

            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                throw APIError.httpError(code, "Stream request failed")
            }

            var fullText = ""
            var editedFiles: [String] = []
            var discoveredFiles: [String] = []

            for try await line in bytes.lines {
                if Task.isCancelled { break }

                guard !line.isEmpty else { continue }

                if let data = line.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    await processStreamChunk(
                        json,
                        fullText: &fullText,
                        editedFiles: &editedFiles,
                        discoveredFiles: &discoveredFiles,
                        assistantMessageId: assistantMessageId
                    )
                }
            }

            let elapsed = Date().timeIntervalSince(streamStart) * 1000

            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = fullText.isEmpty ? "Build complete." : fullText
                messages[idx].editedFiles = editedFiles.isEmpty ? nil : editedFiles
                messages[idx].discoveredFiles = discoveredFiles.isEmpty ? nil : discoveredFiles
                messages[idx].isStreaming = false
                messages[idx].elapsedMs = elapsed
                messages[idx].createdAt = Date()
            }

            buildStatus = .ready
        } catch {
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = "Error: \(error.localizedDescription)"
                messages[idx].isStreaming = false
                messages[idx].createdAt = Date()
            }
            buildStatus = .failed(error.localizedDescription)
            self.error = error.localizedDescription
        }

        isStreaming = false
        streamingFileCount = 0
        recentFiles = []
    }

    private func processStreamChunk(
        _ json: [String: Any],
        fullText: inout String,
        editedFiles: inout [String],
        discoveredFiles: inout [String],
        assistantMessageId: String
    ) async {
        if let phase = json["phase"] as? String {
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].phase = phase
            }
        }

        if let chunk = json["chunk"] as? String {
            fullText += chunk
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = fullText
            }
        }

        if let summary = json["summary"] as? String {
            fullText = summary
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = summary
            }
        }

        if let files = json["editedFiles"] as? [String] {
            editedFiles = files
        }

        if let filePath = json["discoveredFile"] as? String {
            if !discoveredFiles.contains(filePath) {
                discoveredFiles.append(filePath)
                streamingFileCount = discoveredFiles.count
                recentFiles = Array(discoveredFiles.suffix(5))
            }
            if !editedFiles.contains(filePath) {
                editedFiles.append(filePath)
            }
        }
    }
}
