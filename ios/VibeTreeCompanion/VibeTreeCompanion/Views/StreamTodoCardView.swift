import SwiftUI

// MARK: - Stream block helpers (match web getAllStreamBlocks / isStreamStepMessage / getStreamRunId)

private func isStreamStepMessage(id: String) -> Bool {
    id.hasPrefix("stream-progress-") || id.hasPrefix("stream-phase-") || id.hasPrefix("stream-file-")
}

private func getStreamRunId(id: String) -> String? {
    let parts = id.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
    guard parts.count >= 3, parts[0] == "stream" else { return nil }
    return parts[2]
}

private func isStreamFileMessage(id: String) -> Bool {
    id.hasPrefix("stream-file-")
}

struct StreamBlock {
    let start: Int
    let steps: [ChatMessage]
    let runId: String
    let isActive: Bool
}

/// Returns stream blocks grouped by runId. Only the block containing the last stream-step has isActive true.
func getAllStreamBlocks(messages: [ChatMessage]) -> [StreamBlock] {
    var blocks: [StreamBlock] = []
    var i = messages.startIndex
    while i < messages.endIndex {
        let msg = messages[i]
        guard isStreamStepMessage(id: msg.id), let runId = getStreamRunId(id: msg.id) else {
            i += 1
            continue
        }
        let start = i
        var steps: [ChatMessage] = []
        while i < messages.endIndex, isStreamStepMessage(id: messages[i].id), getStreamRunId(id: messages[i].id) == runId {
            steps.append(messages[i])
            i += 1
        }
        blocks.append(StreamBlock(start: start, steps: steps, runId: runId, isActive: false))
    }
    var lastStreamIndex = messages.endIndex - 1
    while lastStreamIndex >= messages.startIndex, !isStreamStepMessage(id: messages[lastStreamIndex].id) {
        lastStreamIndex -= 1
    }
    if lastStreamIndex >= messages.startIndex, let idx = blocks.firstIndex(where: { lastStreamIndex >= $0.start && lastStreamIndex < $0.start + $0.steps.count }) {
        blocks[idx] = StreamBlock(start: blocks[idx].start, steps: blocks[idx].steps, runId: blocks[idx].runId, isActive: true)
    }
    return blocks
}

// MARK: - Display helpers (match web stepDisplayLabel / toPastTense / stripTrailingEllipsis)

private func stepDisplayLabel(_ content: String) -> String {
    var s = content
    if let r = s.range(of: "\\s*·\\s*\\d+s?\\s*$", options: .regularExpression) { s.removeSubrange(r) }
    if let r = s.range(of: "\\s*\\(file \\d+\\)\\s*$", options: .regularExpression) { s.removeSubrange(r) }
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? content : t
}

private func toPastTense(_ label: String) -> String {
    if label.range(of: "^Creating\\s+", options: .regularExpression) != nil {
        return label.replacingOccurrences(of: "^Creating\\s+", with: "Created ", options: .regularExpression)
    }
    if label.range(of: "^Editing\\s+", options: .regularExpression) != nil {
        return label.replacingOccurrences(of: "^Editing\\s+", with: "Edited ", options: .regularExpression)
    }
    return label
}

private func stripTrailingEllipsis(_ text: String) -> String {
    let trimmed = text.replacingOccurrences(of: "\\s*(…|\\.{3})\\s*$", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? text : trimmed
}

// MARK: - StreamTodoCardView (match web StreamTodoCard: to-do box with checkmarks, status above/below)

struct StreamTodoCardView: View {
    let steps: [ChatMessage]
    let isTyping: Bool

    private var fileSteps: [ChatMessage] {
        steps.filter { isStreamFileMessage(id: $0.id) }
    }

    private var firstFileIndex: Int {
        steps.firstIndex(where: { isStreamFileMessage(id: $0.id) }) ?? steps.endIndex
    }

    private var lastFileIndex: Int {
        steps.lastIndex(where: { isStreamFileMessage(id: $0.id) }) ?? -1
    }

    private var statusBeforeFiles: ArraySlice<ChatMessage> {
        if firstFileIndex >= steps.count { return steps[...] }
        return steps[..<firstFileIndex]
    }

    private var statusAfterFiles: ArraySlice<ChatMessage> {
        if lastFileIndex < 0 { return steps[steps.endIndex...] }
        return steps[(lastFileIndex + 1)...]
    }

    private var lastStep: ChatMessage? {
        steps.last
    }

    private var currentIsFile: Bool {
        guard let last = lastStep else { return false }
        return isStreamFileMessage(id: last.id)
    }

    private var currentFileIndex: Int {
        guard let last = lastStep, currentIsFile else { return -1 }
        return fileSteps.firstIndex(where: { $0.id == last.id }) ?? -1
    }

    private var completedTasksCount: Int {
        if isTyping {
            if currentIsFile { return currentFileIndex }
            return fileSteps.count
        }
        return fileSteps.count
    }

    private var statusAbove: String? {
        let phaseSteps = statusBeforeFiles.filter { !isStreamFileMessage(id: $0.id) }
        if fileSteps.isEmpty && !steps.isEmpty {
            return phaseSteps.last.map { stepDisplayLabel($0.text) } ?? "Creating to-do list…"
        }
        return phaseSteps.last.map { stepDisplayLabel($0.text) }
    }

    private var statusBelow: String? {
        let phaseSteps = statusAfterFiles.filter { !isStreamFileMessage(id: $0.id) }
        return phaseSteps.last.map { stepDisplayLabel($0.text) }
    }

    private var isOnStatusAbove: Bool {
        if fileSteps.isEmpty { return isTyping }
        guard isTyping, let lastBefore = statusBeforeFiles.filter({ !isStreamFileMessage(id: $0.id) }).last, let lastStep = lastStep else { return false }
        return lastStep.id == lastBefore.id
    }

    private var isOnStatusBelow: Bool {
        isTyping && statusBelow != nil && statusAfterFiles.filter({ !isStreamFileMessage(id: $0.id) }).last?.id == lastStep?.id
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            if let above = statusAbove {
                HStack(spacing: 4) {
                    Text(isOnStatusAbove ? stripTrailingEllipsis(above) : above)
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(isOnStatusAbove ? Forest.textSecondary : Forest.textTertiary)
                    if isOnStatusAbove {
                        Text("…")
                            .font(Forest.font(size: Forest.textXs))
                            .foregroundColor(Forest.textSecondary)
                    }
                }
            }

            VStack(alignment: .leading, spacing: Forest.space2) {
                HStack {
                    Text("To-do")
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                    Spacer()
                    Text(fileSteps.isEmpty ? (isTyping ? "0 tasks" : "—") : "\(completedTasksCount) of \(fileSteps.count) tasks")
                        .font(Forest.font(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textSecondary)
                }

                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(fileSteps.enumerated()), id: \.element.id) { idx, step in
                        let isCurrent = isTyping && currentIsFile && currentFileIndex == idx
                        let isDone = !isCurrent && (!isTyping || currentFileIndex < 0 || idx < currentFileIndex)
                        let label = stepDisplayLabel(step.text)
                        let displayLabel = isDone ? toPastTense(label) : (isCurrent ? stripTrailingEllipsis(label) : label)

                        HStack(alignment: .center, spacing: Forest.space2) {
                            if isDone {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 14))
                                    .foregroundColor(Forest.semanticSuccess)
                            } else {
                                Circle()
                                    .stroke(Forest.textTertiary.opacity(0.5), lineWidth: 2)
                                    .frame(width: 14, height: 14)
                            }
                            Text(displayLabel)
                                .font(Forest.font(size: Forest.textSm))
                                .foregroundColor(isCurrent ? Forest.textPrimary : Forest.textSecondary)
                            if isCurrent {
                                Text("…")
                                    .font(Forest.font(size: Forest.textSm))
                                    .foregroundColor(Forest.textPrimary)
                            }
                        }
                    }
                }
            }
            .padding(Forest.space3)
            .background(Forest.backgroundSecondary.opacity(0.6))
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(Forest.border.opacity(0.7), lineWidth: 1)
            )

            if let below = statusBelow {
                HStack(spacing: 4) {
                    Text(isOnStatusBelow ? stripTrailingEllipsis(below) : below)
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(isOnStatusBelow ? Forest.textSecondary : Forest.textTertiary)
                    if isOnStatusBelow {
                        Text("…")
                            .font(Forest.font(size: Forest.textXs))
                            .foregroundColor(Forest.textSecondary)
                    }
                }
            }
        }
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
