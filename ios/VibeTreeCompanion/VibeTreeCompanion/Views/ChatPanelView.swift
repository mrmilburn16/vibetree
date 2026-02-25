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
    @FocusState private var isInputFocused: Bool

    private let maxChars = 4000

    private var canSend: Bool {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= maxChars && !chatService.isStreaming
    }

    var body: some View {
        VStack(spacing: 0) {
            topToolbar

            if chatService.isStreaming {
                streamingProgressBar
            }

            messageList

            inputForm
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

    // MARK: - Top Toolbar (matches desktop header bar)

    private var topToolbar: some View {
        HStack(spacing: Forest.space2) {
            buildStatusIndicator

            Spacer()

            projectTypeMenu
            llmMenu

            if chatService.isStreaming {
                Button {
                    chatService.cancel()
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(Forest.error)
                }
            }
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, 10)
        .background(Forest.backgroundPrimary)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Forest.border),
            alignment: .bottom
        )
        .onTapGesture { isInputFocused = false }
    }

    @ViewBuilder
    private var buildStatusIndicator: some View {
        switch chatService.buildStatus {
        case .idle:
            EmptyView()
        case .building:
            HStack(spacing: 6) {
                ProgressView()
                    .tint(Forest.accentLight)
                    .scaleEffect(0.65)
                Text("Building…")
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.accentLight)
            }
        case .ready:
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Forest.accentLight)
                Text("Ready")
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.accentLight)
            }
        case .failed:
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Forest.error)
                Text("Failed")
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.error)
            }
        }
    }

    private var projectTypeMenu: some View {
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
                    .font(.system(size: 11))
                Text(selectedProjectType == .pro ? "Pro (Swift)" : "Standard (Expo)")
                    .font(.system(size: Forest.textXs, weight: .medium))
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 8))
            }
            .foregroundColor(Forest.textSecondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Forest.backgroundTertiary)
            .cornerRadius(Forest.radiusSm)
        }
    }

    private var llmMenu: some View {
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
                    .font(.system(size: 11))
                Text(selectedModel.label)
                    .font(.system(size: Forest.textXs, weight: .medium))
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 8))
            }
            .foregroundColor(Forest.textSecondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Forest.backgroundTertiary)
            .cornerRadius(Forest.radiusSm)
        }
    }

    // MARK: - Streaming Progress Bar

    private var streamingProgressBar: some View {
        let fileCount = chatService.streamingFileCount
        return Group {
            if fileCount > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: Forest.space2) {
                        Text("Building app…")
                            .font(.system(size: Forest.textXs))
                            .foregroundColor(Forest.textTertiary)
                        Spacer()
                        Text("\(fileCount) \(fileCount == 1 ? "file" : "files")")
                            .font(.system(size: Forest.textXs, design: .monospaced))
                            .foregroundColor(Forest.textTertiary)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Forest.border.opacity(0.4))
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Forest.accent)
                                .frame(width: geo.size.width)
                        }
                    }
                    .frame(height: 4)

                    if !chatService.recentFiles.isEmpty {
                        HStack(spacing: Forest.space2) {
                            ForEach(chatService.recentFiles.suffix(3), id: \.self) { file in
                                Text(file.components(separatedBy: "/").last ?? file)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(Forest.textTertiary.opacity(0.7))
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                .padding(.horizontal, Forest.space3)
                .padding(.vertical, Forest.space2)
                .background(Forest.backgroundSecondary.opacity(0.5))
                .cornerRadius(Forest.radiusSm)
                .overlay(
                    RoundedRectangle(cornerRadius: Forest.radiusSm)
                        .stroke(Forest.border.opacity(0.5), lineWidth: 1)
                )
                .padding(.horizontal, Forest.space5)
                .padding(.top, Forest.space2)
            }
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if chatService.messages.isEmpty && !chatService.isStreaming {
                    emptyState
                }

                LazyVStack(spacing: 4) {
                    ForEach(Array(chatService.messages.enumerated()), id: \.element.id) { index, message in
                        MessageBubbleView(message: message, isLast: index == chatService.messages.count - 1)
                            .id(message.id)
                            .transition(.opacity)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, Forest.space5)
                .padding(.vertical, Forest.space4)
                .contentShape(Rectangle())
                .onTapGesture { isInputFocused = false }
            }
            .scrollDismissesKeyboard(.interactively)
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

    private var emptyState: some View {
        VStack(spacing: Forest.space3) {
            Spacer().frame(height: Forest.space12)
            Text("What do you want to build?")
                .font(.system(size: Forest.textXl, weight: .semibold))
                .foregroundColor(Forest.textPrimary)
                .tracking(-0.3)
            Text("Describe your app in plain language—AI writes Swift and you preview live.")
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Forest.space8)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Input Form (matches desktop chat-form-bg area)

    private var inputForm: some View {
        VStack(spacing: Forest.space2) {
            inputPill

            HStack {
                Button {
                    let prompts = [
                        "A weather app with animated backgrounds",
                        "A meditation timer with calming sounds",
                        "A budget tracker with spending charts",
                        "A reading list app with progress tracking",
                        "A countdown timer for upcoming events",
                        "A plant care reminder app",
                    ]
                    inputText = prompts.randomElement() ?? ""
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 10))
                        Text("Mystery app")
                            .font(.system(size: Forest.textXs, weight: .medium))
                    }
                    .foregroundColor(Forest.textTertiary)
                }

                Spacer()

                charCountLabel
            }
            .padding(.horizontal, Forest.space4)
        }
        .padding(.top, Forest.space3)
        .padding(.bottom, Forest.space3)
        .padding(.horizontal, Forest.space4)
        .background(Forest.backgroundSecondary.opacity(0.95))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Forest.border),
            alignment: .top
        )
    }

    private var inputPill: some View {
        HStack(alignment: .center, spacing: Forest.space2) {
            TextField("Describe your app…", text: $inputText, axis: .vertical)
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($isInputFocused)
                .onSubmit { sendIfPossible() }

            sendButton
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, 6)
        .background(Forest.inputBg)
        .cornerRadius(26)
        .overlay(
            RoundedRectangle(cornerRadius: 26)
                .stroke(
                    isInputFocused ? Forest.accent.opacity(0.5) : Forest.inputBorder,
                    lineWidth: 2
                )
        )
        .shadow(color: isInputFocused ? Forest.accent.opacity(0.12) : .clear, radius: 8, y: 0)
        .animation(.easeOut(duration: 0.15), value: isInputFocused)
    }

    private var sendButton: some View {
        Button(action: sendIfPossible) {
            ZStack {
                Circle()
                    .fill(canSend ? Forest.accent : Forest.buttonSecondaryBg)
                    .frame(width: 36, height: 36)
                if canSend {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                } else {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Forest.textTertiary)
                        .frame(width: 12, height: 12)
                }
            }
        }
        .disabled(!canSend)
        .keyboardShortcut(.return, modifiers: .command)
        .scaleEffect(justSent ? 0.9 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.5), value: justSent)
    }

    @ViewBuilder
    private var charCountLabel: some View {
        let count = inputText.count
        if count > maxChars - 500 {
            Text("\(count)/\(maxChars)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(count > maxChars ? Forest.error : Forest.textTertiary)
        }
    }

    private func sendIfPossible() {
        guard canSend else { return }
        let text = inputText
        inputText = ""

        justSent = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { justSent = false }

        chatService.sendMessage(text, model: selectedModel.modelValue, projectType: selectedProjectType)
    }
}
