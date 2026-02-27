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
    /// So we only load from server once per editor session.
    private var hasLoadedHistory = false

    init(projectId: String, projectName: String = "Untitled app") {
        self.projectId = projectId
        self.initialProjectName = projectName
    }

    /// Load conversation history from server so web and iOS stay in sync. Call from view .onAppear.
    func loadHistory() async {
        guard !hasLoadedHistory else { return }
        hasLoadedHistory = true
        do {
            let history = try await APIService.shared.fetchChat(projectId: projectId)
            if !history.isEmpty {
                messages = history
                buildStatus = .ready
                if suggestedProjectName == nil, let name = Self.appNameFromHistory(history) {
                    suggestedProjectName = name
                }
            }
        } catch {
            hasLoadedHistory = false
            logger.error("loadHistory failed: \(error.localizedDescription)")
        }
    }

    /// Extract "App name: X" from the most recent assistant message so the nav title shows the real name.
    private static func appNameFromHistory(_ history: [ChatMessage]) -> String? {
        let prefix = "App name: "
        for msg in history.reversed() {
            guard msg.role == .assistant else { continue }
            let text = msg.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.hasPrefix(prefix) {
                let rest = text.dropFirst(prefix.count)
                let firstLine = rest.prefix(while: { $0 != "\n" })
                let name = String(firstLine).trimmingCharacters(in: .whitespacesAndNewlines)
                if !name.isEmpty, !isUntitledName(name) { return name }
            }
        }
        return nil
    }

    /// Persist current conversation to server (stable messages only). Call after stream completes.
    func persistChat() {
        let stable = messages.filter { !$0.isStreaming }
        guard !stable.isEmpty else { return }
        Task {
            do {
                try await APIService.shared.saveChat(projectId: projectId, messages: stable)
            } catch {
                logger.error("persistChat failed: \(error.localizedDescription)")
            }
        }
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

        if Self.isUntitledName(initialProjectName),
           let derived = Self.deriveTitleFromPrompt(trimmed),
           !Self.isUntitledName(derived) {
            suggestedProjectName = derived
        }

        let assistantId = UUID().uuidString
        messages.append(ChatMessage(
            id: assistantId,
            role: .assistant,
            text: Self.phaseLabel("starting_request"),
            phase: "starting_request",
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
            var discoveredFileIsExisting: [String] = []
            var buildLog: [String] = []
            var doneContent: String?
            var doneEditedFiles: [String]?
            var receivedDoneEvent = false

            for try await line in bytes.lines {
                if Task.isCancelled { break }

                guard !line.isEmpty else { continue }

                if let data = line.data(using: .utf8) {
                    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                    if let json {
                        if (json["type"] as? String) == "done" { receivedDoneEvent = true }
                        await processStreamChunk(
                            json,
                            buildLog: &buildLog,
                            editedFiles: &editedFiles,
                            discoveredFiles: &discoveredFiles,
                            discoveredFileIsExisting: &discoveredFileIsExisting,
                            doneContent: &doneContent,
                            doneEditedFiles: &doneEditedFiles,
                            assistantMessageId: assistantMessageId
                        )
                    } else if line.hasPrefix("{\"type\":\"done\"") {
                        // Payload was too large or malformed; still treat as done so we don't enter recovery.
                        receivedDoneEvent = true
                        logger.info("Stream: treated line as done (parse skipped)")
                    }
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

    /// Finalize a successful build — remove file progress, update message, set app name first, notify.
    private func finalizeSuccess(
        assistantMessageId: String,
        editedFiles: [String],
        discoveredFiles: [String],
        doneContent: String?,
        elapsed: Double?,
        prompt: String
    ) {
        messages.removeAll { $0.id == "stream-files-progress-\(assistantMessageId)" }

        let rawContent = doneContent ?? ""
        let autoTitle = Self.isUntitledName(initialProjectName)
            ? (Self.deriveTitleFromPrompt(prompt) ?? Self.deriveTitleFromSummary(rawContent))
            : nil
        if let autoTitle, !Self.isUntitledName(autoTitle) {
            suggestedProjectName = autoTitle
            Task { @MainActor in
                do {
                    let updated = try await APIService.shared.updateProject(id: projectId, name: autoTitle, bundleId: nil)
                    suggestedProjectName = updated.name
                    ProjectService.shared.updateProjectName(id: projectId, name: updated.name)
                } catch {
                    suggestedProjectName = autoTitle
                    ProjectService.shared.updateProjectName(id: projectId, name: autoTitle)
                }
            }
        }

        if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
            var finalText = rawContent.trimmingCharacters(in: .whitespacesAndNewlines)
            if finalText.isEmpty { finalText = "Build complete." }
            if let autoTitle, !Self.isUntitledName(autoTitle) {
                finalText = "App name: \(autoTitle)\n\n\(finalText)"
            }
            messages[idx].text = finalText
            let fileListOrder = discoveredFiles.isEmpty ? editedFiles : discoveredFiles
            messages[idx].editedFiles = fileListOrder.isEmpty ? nil : fileListOrder
            messages[idx].discoveredFiles = discoveredFiles.isEmpty ? nil : discoveredFiles
            messages[idx].isStreaming = false
            if let elapsed { messages[idx].elapsedMs = elapsed }
            messages[idx].createdAt = Date()
        }

        buildStatus = .ready

        if !editedFiles.isEmpty {
            HapticService.success()
            NotificationService.shared.showLocalNotification(
                title: "Your app is ready!",
                body: "Open Vibetree to view your app."
            )
        }

        persistChat()
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
        discoveredFileIsExisting: inout [String],
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
            if !discoveredFiles.contains(path) {
                discoveredFiles.append(path)
                streamingFileCount = discoveredFiles.count
                recentFiles = Array(discoveredFiles.suffix(5))
            }
            if (json["existing"] as? Bool) == true, !discoveredFileIsExisting.contains(path) {
                discoveredFileIsExisting.append(path)
            }
            if !editedFiles.contains(path) {
                editedFiles.append(path)
            }
            let progressId = "stream-files-progress-\(assistantMessageId)"
            let basenames = discoveredFiles.map { ($0 as NSString).lastPathComponent }
            let maxNames = 6
            let filesPart = basenames.isEmpty
                ? "Writing \(discoveredFiles.count) file\(discoveredFiles.count == 1 ? "" : "s")…"
                : (basenames.prefix(maxNames).joined(separator: ", ") + (basenames.count > maxNames ? " +\(basenames.count - maxNames) more…" : "…"))
            let progressText = "Writing…"
            let progressMsg = ChatMessage(
                id: progressId,
                role: .assistant,
                text: progressText,
                editedFiles: discoveredFiles.isEmpty ? nil : discoveredFiles,
                editedFileIsExisting: discoveredFileIsExisting.isEmpty ? nil : discoveredFileIsExisting,
                isStreaming: true
            )
            if let existingIdx = messages.firstIndex(where: { $0.id == progressId }) {
                messages[existingIdx].text = progressText
                messages[existingIdx].editedFiles = discoveredFiles.isEmpty ? nil : discoveredFiles
                messages[existingIdx].editedFileIsExisting = discoveredFileIsExisting.isEmpty ? nil : discoveredFileIsExisting
            } else if let idx = messages.firstIndex(where: { $0.id == assistantMessageId }) {
                messages.insert(progressMsg, at: idx)
            } else {
                messages.append(progressMsg)
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
