import Foundation
import UIKit
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
    private var recoveryTask: Task<Void, Never>?
    private let projectId: String
    private let initialProjectName: String
    /// When we auto-derive a title and PATCH the server, set this so the UI can show the new name.
    @Published var suggestedProjectName: String?
    /// Tracks the last prompt so foreground recovery can derive a title.
    private var lastPrompt: String?
    /// The assistant message ID to update if recovery succeeds later.
    private var pendingRecoveryMessageId: String?
    /// Whether we're waiting for the server to finish after losing the stream.
    @Published var isAwaitingRecovery = false

    init(projectId: String, projectName: String = "Untitled app") {
        self.projectId = projectId
        self.initialProjectName = projectName
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
        lastPrompt = text

        let bgTaskId = await beginBackgroundTask()

        do {
            let request = try await APIService.shared.streamMessageRequest(
                projectId: projectId,
                message: text,
                model: model,
                projectType: projectType.rawValue
            )

            logger.info("performStream: sending to \(request.url?.absoluteString ?? "nil")")

            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 600
            config.timeoutIntervalForResource = 600
            config.shouldUseExtendedBackgroundIdleMode = true
            let session = URLSession(configuration: config)

            let (bytes, response) = try await session.bytes(for: request)

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
            var receivedDoneEvent = false

            for try await line in bytes.lines {
                if Task.isCancelled { break }

                guard !line.isEmpty else { continue }

                if let data = line.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if (json["type"] as? String) == "done" { receivedDoneEvent = true }
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

            if receivedDoneEvent {
                finalizeSuccess(
                    assistantMessageId: assistantMessageId,
                    editedFiles: doneEditedFiles ?? editedFiles,
                    discoveredFiles: discoveredFiles,
                    doneContent: doneContent,
                    elapsed: Date().timeIntervalSince(streamStart) * 1000,
                    prompt: text
                )
            } else {
                // Stream ended cleanly but no done event — connection was dropped.
                logger.warning("Stream ended without done event — entering recovery mode")
                enterRecoveryMode(assistantMessageId: assistantMessageId)
            }
        } catch {
            // Connection error (iOS killed the socket, network dropped, etc.)
            // The server is likely still generating — don't show an error, enter recovery.
            let isConnectionError = Self.isNetworkOrBackgroundError(error)
            if isConnectionError {
                logger.warning("Stream connection lost (\(error.localizedDescription)) — entering recovery mode")
                enterRecoveryMode(assistantMessageId: assistantMessageId)
            } else {
                if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                    messages[idx].text = "Error: \(error.localizedDescription)"
                    messages[idx].isStreaming = false
                    messages[idx].createdAt = Date()
                }
                buildStatus = .failed(error.localizedDescription)
                self.error = error.localizedDescription
                logger.error("performStream failed: \(error.localizedDescription)")
            }
        }

        isStreaming = false
        streamingFileCount = 0
        recentFiles = []
        await endBackgroundTask(bgTaskId)
    }

    /// Transition to recovery mode: keep status as "building", poll server when foregrounded.
    private func enterRecoveryMode(assistantMessageId: String) {
        pendingRecoveryMessageId = assistantMessageId
        isAwaitingRecovery = true
        buildStatus = .building

        if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
            messages[idx].text = "Still building on server… come back shortly."
            messages[idx].isStreaming = true
        }

        startRecoveryPolling()
    }

    /// Poll the server periodically until files appear or we give up (10 min max).
    private func startRecoveryPolling() {
        recoveryTask?.cancel()
        recoveryTask = Task { [weak self] in
            guard let self else { return }

            let maxWait: TimeInterval = 600
            let start = Date()
            var interval: UInt64 = 5_000_000_000  // start at 5s

            while !Task.isCancelled && Date().timeIntervalSince(start) < maxWait {
                try? await Task.sleep(nanoseconds: interval)
                if Task.isCancelled { break }

                let recovered = await self.checkServerForFiles()
                if recovered { return }

                // Back off: 5s → 10s → 15s → 20s (cap)
                interval = min(interval + 5_000_000_000, 20_000_000_000)
            }

            // Gave up — server never finished.
            await self.recoveryTimedOut()
        }
    }

    /// Called when the app returns to the foreground — immediately check if the server finished.
    func checkRecoveryOnForeground() {
        guard isAwaitingRecovery else { return }
        Task {
            let recovered = await checkServerForFiles()
            if !recovered {
                logger.info("Foreground check: server not done yet, polling continues")
            }
        }
    }

    private func checkServerForFiles() async -> Bool {
        do {
            let data = try await APIService.shared.fetchProjectRaw(id: projectId)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let fileCount = json["fileCount"] as? Int,
                  fileCount > 0,
                  let filePaths = json["filePaths"] as? [String] else {
                return false
            }

            logger.info("Recovery: server has \(fileCount) files")

            let prompt = lastPrompt ?? ""
            let doneContent = "App built. \(fileCount) files generated."

            if let msgId = pendingRecoveryMessageId {
                finalizeSuccess(
                    assistantMessageId: msgId,
                    editedFiles: filePaths,
                    discoveredFiles: filePaths,
                    doneContent: doneContent,
                    elapsed: nil,
                    prompt: prompt
                )
            }

            isAwaitingRecovery = false
            pendingRecoveryMessageId = nil
            recoveryTask?.cancel()
            return true
        } catch {
            logger.error("Recovery poll failed: \(error.localizedDescription)")
            return false
        }
    }

    private func recoveryTimedOut() {
        guard isAwaitingRecovery else { return }
        isAwaitingRecovery = false

        if let msgId = pendingRecoveryMessageId {
            if let idx = messages.firstIndex(where: { $0.id == msgId }) {
                messages[idx].text = "Build timed out. The server may still be processing — try refreshing."
                messages[idx].isStreaming = false
                messages[idx].createdAt = Date()
            }
        }
        pendingRecoveryMessageId = nil
        buildStatus = .failed("Connection lost and recovery timed out")
    }

    /// Finalize a successful build — update message, notify, auto-title.
    private func finalizeSuccess(
        assistantMessageId: String,
        editedFiles: [String],
        discoveredFiles: [String],
        doneContent: String?,
        elapsed: Double?,
        prompt: String
    ) {
        if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
            let finalText = doneContent ?? "Build complete."
            messages[idx].text = finalText.isEmpty ? "Build complete." : finalText
            messages[idx].editedFiles = editedFiles.isEmpty ? nil : editedFiles
            messages[idx].discoveredFiles = discoveredFiles.isEmpty ? nil : discoveredFiles
            messages[idx].isStreaming = false
            if let elapsed { messages[idx].elapsedMs = elapsed }
            messages[idx].createdAt = Date()
        }

        buildStatus = .ready

        if !editedFiles.isEmpty {
            NotificationService.shared.showLocalNotification(
                title: "Your app is ready!",
                body: "Open Vibetree to view your app."
            )
            if Self.isUntitledName(initialProjectName) {
                let rawContent = doneContent ?? ""
                let autoTitle = Self.deriveTitleFromPrompt(prompt) ?? Self.deriveTitleFromSummary(rawContent)
                if let autoTitle, !Self.isUntitledName(autoTitle) {
                    suggestedProjectName = autoTitle
                    Task {
                        try? await APIService.shared.updateProject(id: projectId, name: autoTitle, bundleId: nil)
                    }
                }
            }
        }
    }

    // MARK: - Background task helpers

    private func beginBackgroundTask() async -> UIBackgroundTaskIdentifier {
        await MainActor.run {
            UIApplication.shared.beginBackgroundTask {
                // Expiration handler — iOS is about to kill us.
            }
        }
    }

    private func endBackgroundTask(_ id: UIBackgroundTaskIdentifier) async {
        guard id != .invalid else { return }
        await MainActor.run {
            UIApplication.shared.endBackgroundTask(id)
        }
    }

    /// Returns true for errors caused by network/backgrounding (not server-side logic errors).
    private static func isNetworkOrBackgroundError(_ error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain { return true }
        let desc = error.localizedDescription.lowercased()
        return desc.contains("connection") || desc.contains("network")
            || desc.contains("timed out") || desc.contains("cancelled")
    }

    private static func isUntitledName(_ name: String?) -> Bool {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return n.isEmpty || n == "untitled app" || n == "untitled"
    }

    /// e.g. "Build an Airbnb clone" -> "Airbnb Clone"
    private static func deriveTitleFromPrompt(_ prompt: String) -> String? {
        let p = prompt.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "  ", with: " ")
        guard !p.isEmpty else { return nil }
        let pattern = #"(?i)^(?:build|create|make|design)\s+(?:an?|the)\s+(.+?)(?:[.\n,]|\s+with\s+|\s+that\s+|\s+which\s+|\s+where\s+|$)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: p, range: NSRange(p.startIndex..., in: p)),
              let range = Range(match.range(at: 1), in: p) else { return nil }
        var raw = String(p[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        raw = raw.replacingOccurrences(of: #"\b(app|application)\b"#, with: "", options: .regularExpression)
        raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard raw.count >= 3 else { return nil }
        return String(raw.prefix(42)).capitalized
    }

    /// e.g. "Built a fitness tracker" -> "Fitness Tracker"
    private static func deriveTitleFromSummary(_ summary: String) -> String? {
        let s = summary.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "  ", with: " ")
        guard !s.isEmpty else { return nil }
        let pattern = #"(?i)^(?:built|created|made)\s+(?:an?|the)\s+(.+?)(?:[.\n,]|\s+with\s+|\s+that\s+|\s+which\s+|\s+where\s+|$)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)),
              let range = Range(match.range(at: 1), in: s) else { return nil }
        var raw = String(s[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        raw = raw.replacingOccurrences(of: #"\b(app|application)\b"#, with: "", options: .regularExpression)
        raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard raw.count >= 3 else { return nil }
        return String(raw.prefix(42)).capitalized
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
