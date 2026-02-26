import Foundation
import os.log

private let logger = Logger(subsystem: "com.vibetree.companion", category: "ChatService")

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
        guard !trimmed.isEmpty, trimmed.count <= 4000 else {
            logger.error("sendMessage blocked: empty or too long (\(text.count) chars)")
            return
        }
        guard !isStreaming else {
            logger.error("sendMessage blocked: already streaming")
            return
        }

        logger.info("sendMessage: projectId=\(self.projectId) model=\(model) type=\(projectType.rawValue)")
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

            logger.info("performStream: sending to \(request.url?.absoluteString ?? "nil")")
            let (bytes, response) = try await URLSession.shared.bytes(for: request)

            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                logger.error("performStream: HTTP \(code)")
                throw APIError.httpError(code, "Stream request failed")
            }
            logger.info("performStream: connected, HTTP \(http.statusCode)")

            var editedFiles: [String] = []
            var discoveredFiles: [String] = []
            var buildLog: [String] = []
            var doneContent: String?
            var doneEditedFiles: [String]?

            for try await line in bytes.lines {
                if Task.isCancelled { break }

                guard !line.isEmpty else { continue }

                if let data = line.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    await processStreamChunk(
                        json,
                        buildLog: &buildLog,
                        editedFiles: &editedFiles,
                        discoveredFiles: &discoveredFiles,
                        doneContent: &doneContent,
                        doneEditedFiles: &doneEditedFiles,
                        assistantMessageId: assistantMessageId
                    )
                }
            }

            let elapsed = Date().timeIntervalSince(streamStart) * 1000

            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                let finalText = doneContent ?? (buildLog.isEmpty ? "Build complete." : buildLog.joined(separator: "\n"))
                messages[idx].text = finalText.isEmpty ? "Build complete." : finalText
                messages[idx].editedFiles = (doneEditedFiles ?? editedFiles).isEmpty ? nil : (doneEditedFiles ?? editedFiles)
                messages[idx].discoveredFiles = discoveredFiles.isEmpty ? nil : discoveredFiles
                messages[idx].isStreaming = false
                messages[idx].elapsedMs = elapsed
                messages[idx].createdAt = Date()
            }

            buildStatus = .ready
            let files = doneEditedFiles ?? editedFiles
            if !files.isEmpty {
                NotificationService.shared.showLocalNotification(
                    title: "Your app is ready!",
                    body: "Open Vibetree to view your app."
                )
            }
        } catch {
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = "Error: \(error.localizedDescription)"
                messages[idx].isStreaming = false
                messages[idx].createdAt = Date()
            }
            buildStatus = .failed(error.localizedDescription)
            self.error = error.localizedDescription
            logger.error("performStream failed: \(error.localizedDescription)")
        }

        isStreaming = false
        streamingFileCount = 0
        recentFiles = []
    }

    private static func phaseLabel(_ phase: String) -> String {
        switch phase {
        case "starting_request": return "Starting…"
        case "waiting_for_first_tokens": return "Waiting for first tokens…"
        case "receiving_output": return "Receiving code…"
        case "validating_structured_output": return "Validating output…"
        case "saving_files": return "Saving files…"
        case "done_preview_updating": return "Done."
        case "retrying_request": return "Retrying…"
        default: return phase.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func processStreamChunk(
        _ json: [String: Any],
        buildLog: inout [String],
        editedFiles: inout [String],
        discoveredFiles: inout [String],
        doneContent: inout String?,
        doneEditedFiles: inout [String]?,
        assistantMessageId: String
    ) async {
        let eventType = json["type"] as? String

        if eventType == "phase", let phase = json["phase"] as? String {
            let label = Self.phaseLabel(phase)
            if buildLog.last != label {
                buildLog.append(label)
                if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                    messages[idx].phase = phase
                    messages[idx].text = buildLog.joined(separator: "\n")
                }
            }
        }

        if eventType == "file", let path = json["path"] as? String {
            let count = (json["count"] as? NSNumber)?.intValue ?? (discoveredFiles.count + 1)
            let fileName = (path as NSString).lastPathComponent
            let line = "Generating \(fileName) (file \(count))"
            if !discoveredFiles.contains(path) {
                discoveredFiles.append(path)
                streamingFileCount = discoveredFiles.count
                recentFiles = Array(discoveredFiles.suffix(5))
            }
            if !editedFiles.contains(path) {
                editedFiles.append(path)
            }
            buildLog.append(line)
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = buildLog.joined(separator: "\n")
            }
        }

        if eventType == "done", let assistant = json["assistantMessage"] as? [String: Any] {
            doneContent = assistant["content"] as? String
            if let files = assistant["editedFiles"] as? [String] {
                doneEditedFiles = files
            }
        }

        if eventType == "error", let err = json["error"] as? String {
            if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages[idx].text = "Error: \(err)"
            }
        }
    }
}
