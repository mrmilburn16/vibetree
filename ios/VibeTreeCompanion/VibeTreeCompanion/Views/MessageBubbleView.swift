import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage
    var isLast: Bool = false

    @State private var visibleWordCount: Int = 0
    @State private var animationTimer: Timer?
    @State private var hasAnimated = false

    private var isReasoning: Bool {
        guard message.role == .assistant else { return false }
        if message.editedFiles?.isEmpty == false { return false }
        let text = message.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.count < 50 { return true }
        let phrases: Set<String> = [
            "Reading files.", "Explored.", "Grepped.", "Analyzed.",
            "Planning next moves…", "Writing code…", "Validating build on Mac…",
        ]
        return phrases.contains(text)
    }

    var body: some View {
        switch message.role {
        case .user:
            userBubble
        case .assistant:
            if isReasoning {
                reasoningBubble
            } else {
                assistantBubble
            }
        case .system:
            systemBubble
        }
    }

    // MARK: - User (right-aligned pill with left accent border)

    private var userBubble: some View {
        HStack {
            Spacer(minLength: 44)
            Text(message.text)
                .font(Forest.font(size: Forest.textSm, weight: .medium))
                .foregroundColor(Forest.textPrimary)
                .lineSpacing(3)
                .multilineTextAlignment(.trailing)
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space3)
                .background(Forest.chatBubbleUserBg)
                .cornerRadius(Forest.radiusLg)
                .overlay(
                    RoundedRectangle(cornerRadius: Forest.radiusLg)
                        .stroke(Forest.border, lineWidth: 1)
                )
                .overlay(alignment: .leading) {
                    UnevenRoundedRectangle(
                        topLeadingRadius: Forest.radiusLg,
                        bottomLeadingRadius: Forest.radiusLg,
                        bottomTrailingRadius: 0,
                        topTrailingRadius: 0
                    )
                    .fill(Forest.accent.opacity(0.5))
                    .frame(width: 3)
                }
        }
    }

    // MARK: - Assistant (full-box fog, no card border)

    private var assistantBubble: some View {
        HStack {
            VStack(alignment: .leading, spacing: Forest.space2) {
                if message.isStreaming, let phase = message.phase {
                    HStack(spacing: Forest.space2) {
                        ProgressView()
                            .tint(Forest.accent)
                            .scaleEffect(0.65)
                        Text(phaseLabel(phase))
                            .font(Forest.font(size: Forest.textXs, weight: .medium))
                            .foregroundColor(Forest.textTertiary)
                    }
                }

                if !message.text.isEmpty {
                    streamingText
                }

                if let files = message.editedFiles, !files.isEmpty {
                    fileList(files)
                }

                if message.isStreaming && message.text.isEmpty {
                    typingDots
                }

                if !message.isStreaming {
                    metadataRow
                }
            }
            .padding(.horizontal, Forest.space2)
            .padding(.vertical, 2)
            .background(
                RadialGradient(
                    colors: [
                        Forest.accent.opacity(0.08),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 180
                )
            )

            Spacer(minLength: 44)
        }
    }

    // MARK: - Reasoning (small muted inline text, no bubble)

    private var reasoningBubble: some View {
        HStack {
            Text(message.text)
                .font(Forest.font(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
                .lineSpacing(2)
                .padding(.vertical, 1)

            Spacer()
        }
    }

    // MARK: - Streaming text (word-by-word)

    /// Build log (phases + "Generating X") should show in full as it updates; no word-by-word.
    private var isBuildLog: Bool {
        message.isStreaming && (message.text.contains("\n") || message.text.contains("Generating "))
    }

    @ViewBuilder
    private var streamingText: some View {
        let words = message.text.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        let total = words.count

        if message.isStreaming && !hasAnimated && !isBuildLog {
            Text(words.prefix(visibleWordCount).joined(separator: " "))
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textPrimary)
                .lineSpacing(3)
                .textSelection(.enabled)
                .onAppear { startWordAnimation(totalWords: total) }
                .onDisappear { animationTimer?.invalidate() }
                .onChange(of: message.text) { _, _ in
                    visibleWordCount = total
                }
        } else {
            Text(message.text)
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textPrimary)
                .lineSpacing(3)
                .textSelection(.enabled)
                .onAppear { if !isBuildLog { hasAnimated = true } }
        }
    }

    private func startWordAnimation(totalWords: Int) {
        visibleWordCount = 0
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.045, repeats: true) { timer in
            if visibleWordCount < totalWords {
                visibleWordCount += 1
            } else {
                timer.invalidate()
                hasAnimated = true
            }
        }
    }

    // MARK: - File list (inline comma-separated monospace, like desktop)

    private func fileList(_ files: [String]) -> some View {
        Text(files.joined(separator: ", "))
            .font(Forest.fontMono(size: Forest.textXs))
            .foregroundColor(Forest.textSecondary)
            .lineLimit(3)
            .padding(.top, message.text.isEmpty ? 0 : Forest.space2)
    }

    // MARK: - Metadata (dot-separated, like desktop)

    @ViewBuilder
    private var metadataRow: some View {
        let parts = metadataParts
        if !parts.isEmpty {
            Text(parts.joined(separator: " · "))
                .font(Forest.font(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
                .padding(.top, 2)
        }
    }

    private var metadataParts: [String] {
        var parts: [String] = []
        if let elapsed = message.elapsedMs {
            let seconds = Int(elapsed / 1000)
            if seconds > 0 {
                parts.append("Generated in \(seconds)s")
            }
        }
        let age = Date().timeIntervalSince(message.createdAt)
        if age > 60 {
            parts.append("Built \(formatTimeAgo(age))")
        }
        return parts
    }

    private func formatTimeAgo(_ interval: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        return "\(days)d ago"
    }

    // MARK: - Typing dots

    private var typingDots: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { i in
                Circle()
                    .fill(Forest.accent.opacity(0.4))
                    .frame(width: 5, height: 5)
                    .scaleEffect(message.isStreaming ? 1.2 : 0.8)
                    .animation(
                        .easeInOut(duration: 0.5)
                            .repeatForever()
                            .delay(Double(i) * 0.15),
                        value: message.isStreaming
                    )
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - System

    private var systemBubble: some View {
        HStack {
            Spacer()
            Text(message.text)
                .font(Forest.font(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
                .padding(.vertical, 2)
            Spacer()
        }
    }

    private func phaseLabel(_ phase: String) -> String {
        switch phase {
        case "starting_request": return "Starting…"
        case "receiving_output": return "Receiving code…"
        case "saving_files": return "Saving files…"
        case "complete": return "Complete"
        default: return phase.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}
