import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage

    var body: some View {
        switch message.role {
        case .user:
            userBubble
        case .assistant:
            assistantBubble
        case .system:
            systemBubble
        }
    }

    // MARK: - User

    private var userBubble: some View {
        HStack {
            Spacer(minLength: 60)
            Text(message.text)
                .font(.system(size: Forest.textBase))
                .foregroundColor(Forest.textPrimary)
                .modifier(ForestUserBubbleModifier())
        }
    }

    // MARK: - Assistant

    private var assistantBubble: some View {
        HStack {
            VStack(alignment: .leading, spacing: Forest.space2) {
                if message.isStreaming, let phase = message.phase {
                    HStack(spacing: Forest.space2) {
                        ProgressView()
                            .tint(Forest.accent)
                            .scaleEffect(0.7)
                        Text(phaseLabel(phase))
                            .font(.system(size: Forest.textXs, weight: .medium))
                            .foregroundColor(Forest.textTertiary)
                    }
                }

                if !message.text.isEmpty {
                    Text(message.text)
                        .font(.system(size: Forest.textBase))
                        .foregroundColor(Forest.textPrimary)
                        .textSelection(.enabled)
                }

                if let files = message.editedFiles, !files.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Edited files")
                            .font(.system(size: Forest.textXs, weight: .semibold))
                            .foregroundColor(Forest.textTertiary)
                            .textCase(.uppercase)
                            .tracking(0.6)

                        ForEach(files, id: \.self) { file in
                            HStack(spacing: 4) {
                                Image(systemName: "doc.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(Forest.accent)
                                Text(file)
                                    .font(.system(size: Forest.textXs, design: .monospaced))
                                    .foregroundColor(Forest.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.top, Forest.space1)
                }

                if message.isStreaming && message.text.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(0..<3) { i in
                            Circle()
                                .fill(Forest.accent.opacity(0.5))
                                .frame(width: 6, height: 6)
                        }
                    }
                    .padding(.vertical, Forest.space1)
                }
            }
            .modifier(ForestAssistantBubbleModifier())

            Spacer(minLength: 40)
        }
    }

    // MARK: - System

    private var systemBubble: some View {
        HStack {
            Spacer()
            Text(message.text)
                .font(.system(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
                .padding(.vertical, Forest.space1)
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
