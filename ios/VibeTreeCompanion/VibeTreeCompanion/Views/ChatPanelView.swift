import SwiftUI

struct ChatPanelView: View {
    @ObservedObject var chatService: ChatService
    let projectType: ProjectType
    var pendingPrompt: String?

    @State private var inputText = ""
    @State private var selectedModel: LLMOption = .defaultOption
    @State private var selectedProjectType: ProjectType = .pro
    @State private var justSent = false
    @State private var hasSentPending = false

    private let maxChars = 4000

    private var canSend: Bool {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= maxChars && !chatService.isStreaming
    }

    var body: some View {
        VStack(spacing: 0) {
            messageList
            streamingProgressBar
            toolbarRow
            inputBar
        }
        .onAppear {
            selectedProjectType = projectType
            if let prompt = pendingPrompt, !hasSentPending {
                hasSentPending = true
                inputText = prompt
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    sendIfPossible()
                }
            }
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Forest.space3) {
                    ForEach(Array(chatService.messages.enumerated()), id: \.element.id) { index, message in
                        MessageBubbleView(message: message)
                            .id(message.id)
                            .transition(.asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .opacity
                            ))
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(Forest.space4)
            }
            .background(
                RadialGradient(
                    colors: [
                        Forest.accent.opacity(0.04),
                        Color.clear
                    ],
                    center: .init(x: 0.5, y: 0.45),
                    startRadius: 0,
                    endRadius: 400
                )
            )
            .onChange(of: chatService.messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: chatService.messages.last?.text) { _, _ in
                proxy.scrollTo("bottom", anchor: .bottom)
            }
        }
    }

    // MARK: - Streaming Progress Bar

    @ViewBuilder
    private var streamingProgressBar: some View {
        if chatService.isStreaming {
            let fileCount = chatService.streamingFileCount
            if fileCount > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: Forest.space2) {
                        ProgressView()
                            .tint(Forest.accent)
                            .scaleEffect(0.6)

                        Text("Building app… \(fileCount) file\(fileCount == 1 ? "" : "s")")
                            .font(.system(size: Forest.textXs, weight: .medium))
                            .foregroundColor(Forest.textSecondary)

                        Spacer()
                    }

                    if !chatService.recentFiles.isEmpty {
                        HStack(spacing: Forest.space2) {
                            ForEach(chatService.recentFiles.suffix(3), id: \.self) { file in
                                Text(file.components(separatedBy: "/").last ?? file)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(Forest.textTertiary)
                                    .lineLimit(1)
                            }
                        }
                    }

                    ProgressView(value: Double(fileCount), total: max(Double(fileCount), 1))
                        .progressViewStyle(ForestProgressBarStyle(height: 4))
                }
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space2)
                .background(Forest.backgroundSecondary)
                .overlay(
                    Rectangle().frame(height: 1).foregroundColor(Forest.border),
                    alignment: .top
                )
            }
        }
    }

    // MARK: - Toolbar (LLM + Project Type)

    private var toolbarRow: some View {
        HStack(spacing: Forest.space2) {
            Menu {
                ForEach(LLMOption.options) { option in
                    Button {
                        if !option.disabled { selectedModel = option }
                    } label: {
                        HStack {
                            Text(option.label)
                            if option.disabled {
                                Text("Soon")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(Forest.textTertiary)
                            }
                            if option.id == selectedModel.id {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                    .disabled(option.disabled)
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "cpu")
                        .font(.system(size: 12))
                    Text(selectedModel.label)
                        .font(.system(size: Forest.textXs, weight: .medium))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 8))
                }
                .foregroundColor(Forest.textSecondary)
                .padding(.horizontal, Forest.space2)
                .padding(.vertical, 6)
                .background(Forest.backgroundTertiary)
                .cornerRadius(Forest.radiusSm)
            }

            Menu {
                ForEach(ProjectType.allCases, id: \.rawValue) { type in
                    Button {
                        selectedProjectType = type
                    } label: {
                        HStack {
                            Image(systemName: type.icon)
                            Text(type.displayName)
                            if type == selectedProjectType {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: selectedProjectType.icon)
                        .font(.system(size: 12))
                    Text(selectedProjectType == .pro ? "Pro" : "Standard")
                        .font(.system(size: Forest.textXs, weight: .medium))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 8))
                }
                .foregroundColor(Forest.textSecondary)
                .padding(.horizontal, Forest.space2)
                .padding(.vertical, 6)
                .background(Forest.backgroundTertiary)
                .cornerRadius(Forest.radiusSm)
            }

            Spacer()

            if chatService.isStreaming {
                Button {
                    chatService.cancel()
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(Forest.error)
                }
            }

            buildStatusBadge
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space2)
        .background(Forest.backgroundSecondary)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Forest.border),
            alignment: .top
        )
    }

    @State private var buildDotPulse = false

    private var buildStatusBadge: some View {
        HStack(spacing: 6) {
            ZStack {
                if chatService.buildStatus == .building {
                    Circle()
                        .fill(statusColor.opacity(0.3))
                        .frame(width: 12, height: 12)
                        .scaleEffect(buildDotPulse ? 1.6 : 1.0)
                        .opacity(buildDotPulse ? 0 : 0.6)
                        .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: false), value: buildDotPulse)
                        .onAppear { buildDotPulse = true }
                        .onDisappear { buildDotPulse = false }
                }
                Circle()
                    .fill(statusColor)
                    .frame(width: 6, height: 6)
            }
            Text(chatService.buildStatus.label)
                .font(.system(size: Forest.textXs, weight: .medium))
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, Forest.space2)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(Forest.radiusXl)
    }

    private var statusColor: Color {
        switch chatService.buildStatus {
        case .idle: return Forest.textTertiary
        case .building: return Forest.warning
        case .ready: return Forest.success
        case .failed: return Forest.error
        }
    }

    // MARK: - Input Bar

    @FocusState private var isInputFocused: Bool

    private var inputBar: some View {
        HStack(alignment: .center, spacing: Forest.space2) {
            TextField("Describe your app…", text: $inputText, axis: .vertical)
                .font(.system(size: Forest.textBase))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($isInputFocused)
                .onSubmit { sendIfPossible() }

            sendButton
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space2)
        .background(Forest.inputBg)
        .cornerRadius(26)
        .overlay(
            RoundedRectangle(cornerRadius: 26)
                .stroke(
                    isInputFocused ? Forest.accent.opacity(0.5) : Forest.inputBorder,
                    lineWidth: isInputFocused ? 2 : 1
                )
        )
        .shadow(color: isInputFocused ? Forest.accent.opacity(0.15) : .clear, radius: 12, y: 0)
        .animation(.easeOut(duration: 0.2), value: isInputFocused)
        .padding(.horizontal, Forest.space4)
        .padding(.bottom, Forest.space3)
        .background(Forest.backgroundPrimary)
        .overlay(
            charCountLabel,
            alignment: .topTrailing
        )
    }

    private var sendButton: some View {
        Button(action: sendIfPossible) {
            ZStack {
                Circle()
                    .fill(canSend ? Forest.accent : Forest.buttonSecondaryBg)
                    .frame(width: 40, height: 40)
                    .shadow(color: canSend ? Forest.accent.opacity(0.3) : .clear, radius: 8, y: 2)
                if canSend {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                } else {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Forest.textTertiary)
                        .frame(width: 14, height: 14)
                }
            }
        }
        .disabled(!canSend)
        .keyboardShortcut(.return, modifiers: .command)
        .scaleEffect(justSent ? 0.88 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.5), value: justSent)
    }

    @ViewBuilder
    private var charCountLabel: some View {
        let count = inputText.count
        if count > maxChars - 500 {
            Text("\(count)/\(maxChars)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(count > maxChars ? Forest.error : Forest.textTertiary)
                .padding(.trailing, Forest.space6)
                .padding(.top, -14)
        }
    }

    private func sendIfPossible() {
        guard canSend else { return }
        let text = inputText
        inputText = ""

        justSent = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { justSent = false }

        chatService.sendMessage(text, model: selectedModel.modelValue, projectType: selectedProjectType)
    }
}
