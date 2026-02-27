import SwiftUI

struct ChatPanelView: View {
    /// Shared width for collapsed dropdown triggers and open LLM panel so they match (not full-width).
    private static let dropdownTriggerWidth: CGFloat = 160

    @ObservedObject var chatService: ChatService
    let projectId: String
    let projectType: ProjectType
    var pendingPrompt: String?

    @State private var inputText = ""
    @State private var selectedModel: LLMOption = .defaultOption
    @State private var selectedProjectType: ProjectType = .pro
    @State private var justSent = false
    @State private var hasSentPending = false
    @FocusState private var isInputFocused: Bool
    @State private var preflightChecks: PreflightResponse?
    @State private var preflightLoading = false
    @State private var isLLMMenuOpen = false

    private let maxChars = 4000

    private func triggerDropdownHaptic() {
        HapticService.light()
    }

    private var blockSendUntilPreflight: Bool {
        guard selectedProjectType == .pro else { return false }
        if preflightLoading { return true }
        guard let checks = preflightChecks else { return true }
        return !checks.runOnDeviceReady
    }

    private var canSend: Bool {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= maxChars && !chatService.isStreaming && !blockSendUntilPreflight
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
            runPreflightIfNeeded()
            if let prompt = pendingPrompt, !hasSentPending {
                hasSentPending = true
                inputText = prompt
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    sendIfPossible()
                }
            }
        }
        .onChange(of: selectedProjectType) { _, _ in
            runPreflightIfNeeded()
        }
        .overlay {
            if isLLMMenuOpen {
                ZStack(alignment: .top) {
                    Color.black.opacity(0.001)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture { isLLMMenuOpen = false }
                    HStack(spacing: 0) {
                        Spacer(minLength: Forest.space2)
                        llmDropdownList
                        Spacer(minLength: Forest.space2)
                    }
                    .padding(.top, 56)
                    .zIndex(1)
                }
            }
        }
    }

    private func runPreflightIfNeeded() {
        guard selectedProjectType == .pro else {
            preflightChecks = nil
            return
        }
        preflightLoading = true
        Task {
            do {
                let checks = try await APIService.shared.fetchPreflight(projectId: projectId, teamId: "")
                await MainActor.run {
                    preflightChecks = checks
                    preflightLoading = false
                }
            } catch {
                await MainActor.run {
                    preflightChecks = nil
                    preflightLoading = false
                }
            }
        }
    }

    // MARK: - Top Toolbar (matches desktop header bar)

    private var topToolbar: some View {
        HStack(spacing: Forest.space2) {
            buildStatusIndicator

            Spacer(minLength: Forest.space2)

            projectTypeMenu
            llmMenu

            Spacer(minLength: Forest.space2)

            if chatService.isStreaming {
                Button {
                    chatService.cancel()
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(Forest.font(size: 18))
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
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.accentLight)
            }
        case .ready:
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle")
                    .font(Forest.font(size: 14, weight: .semibold))
                    .foregroundColor(Forest.accentLight)
                Text("Ready")
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.accentLight)
            }
        case .failed:
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle")
                    .font(Forest.font(size: 14, weight: .semibold))
                    .foregroundColor(Forest.error)
                Text("Failed")
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.error)
            }
        }
    }

    private var projectTypeMenu: some View {
        Menu {
            ForEach(ProjectType.dropdownOrder, id: \.rawValue) { type in
                Button {
                    HapticService.selection()
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
            HStack(spacing: Forest.space2) {
                Image(systemName: selectedProjectType.icon)
                    .font(Forest.font(size: 14))
                    .foregroundColor(Forest.textSecondary)
                Text(selectedProjectType == .pro ? "Pro (Swift)" : "Standard (Expo)")
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.inputText)
                Spacer(minLength: Forest.space2)
                Image(systemName: "chevron.down")
                    .font(Forest.font(size: 14, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
            }
            .contentShape(Rectangle())
            .padding(.leading, Forest.space3)
            .padding(.trailing, Forest.space4)
            .frame(minWidth: ChatPanelView.dropdownTriggerWidth, minHeight: 40, maxHeight: 40)
            .fixedSize(horizontal: true, vertical: false)
            .background(Forest.inputBg)
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(Forest.inputBorder, lineWidth: 2)
            )
            .simultaneousGesture(TapGesture().onEnded { triggerDropdownHaptic() })
        }
        .buttonStyle(.plain)
    }

    private var llmMenu: some View {
        Button {
            triggerDropdownHaptic()
            isLLMMenuOpen.toggle()
        } label: {
            HStack(spacing: Forest.space2) {
                llmIcon(for: selectedModel)
                Text(selectedModel.label)
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.inputText)
                    .lineLimit(1)
                Spacer(minLength: Forest.space2)
                Image(systemName: "chevron.down")
                    .font(Forest.font(size: 14, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
            }
            .padding(.leading, Forest.space3)
            .padding(.trailing, Forest.space4)
            .frame(minWidth: ChatPanelView.dropdownTriggerWidth, minHeight: 40, maxHeight: 40)
            .fixedSize(horizontal: true, vertical: false)
            .background(Forest.inputBg)
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(isLLMMenuOpen ? Forest.accent : Forest.inputBorder, lineWidth: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(isLLMMenuOpen ? Forest.accent.opacity(0.3) : Color.clear, lineWidth: 4)
                    .padding(-2)
            )
        }
        .buttonStyle(.plain)
    }

    /// Icons match web: Auto = Zap (bolt), Claude = Anthropic logo image, GPT = OpenAI-style (cpu).
    @ViewBuilder
    private func llmIcon(for option: LLMOption) -> some View {
        Group {
            if option.id == "auto" {
                Image(systemName: "bolt.fill")
                    .font(Forest.font(size: 14))
                    .foregroundColor(option.disabled ? Forest.textTertiary : Forest.textSecondary)
            } else if option.id.hasPrefix("gpt") {
                Image(systemName: "cpu")
                    .font(Forest.font(size: 14))
                    .foregroundColor(option.disabled ? Forest.textTertiary : Forest.textSecondary)
            } else {
                // Claude: same asset as web (AnthropicLogo = claude-logo.png), no tint
                Image("ClaudeLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 16, height: 16)
            }
        }
    }

    private var llmDropdownList: some View {
        VStack(spacing: 0) {
            ForEach(LLMOption.options) { option in
                Button {
                    if !option.disabled {
                        HapticService.selection()
                        selectedModel = option
                        isLLMMenuOpen = false
                    }
                } label: {
                    HStack(spacing: Forest.space2) {
                        llmIcon(for: option)
                        Text(option.label)
                            .font(Forest.font(size: Forest.textSm))
                            .lineLimit(1)
                        Spacer(minLength: Forest.space2)
                        if option.disabled {
                            Text("SOON")
                                .font(Forest.font(size: 9, weight: .semibold))
                                .tracking(0.5)
                                .textCase(.uppercase)
                                .foregroundColor(Forest.accent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Forest.accent.opacity(0.15))
                                .clipShape(Capsule())
                        } else if option.id == selectedModel.id {
                            Image(systemName: "checkmark")
                                .font(Forest.font(size: 12, weight: .semibold))
                                .foregroundColor(Forest.accent)
                        }
                    }
                    .padding(.horizontal, Forest.space3)
                    .padding(.vertical, Forest.space2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(option.id == selectedModel.id && !option.disabled ? Forest.accent.opacity(0.15) : Color.clear)
                    .foregroundColor(option.disabled ? Forest.textTertiary : (option.id == selectedModel.id ? Forest.accent : Forest.textPrimary))
                    .opacity(option.disabled ? 0.5 : 1)
                }
                .buttonStyle(.plain)
                .disabled(option.disabled)
            }
        }
        .frame(minWidth: ChatPanelView.dropdownTriggerWidth, maxWidth: ChatPanelView.dropdownTriggerWidth)
        .background(Forest.backgroundSecondary)
        .cornerRadius(Forest.radiusMd)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusMd)
                .stroke(Forest.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
    }

    // MARK: - Streaming Progress Bar

    private var streamingProgressBar: some View {
        let fileCount = chatService.streamingFileCount
        return Group {
            if fileCount > 0 {
                HStack(spacing: Forest.space2) {
                    ProgressView()
                        .tint(Forest.accent)
                        .scaleEffect(0.6)
                    Text("Building app… \(fileCount) \(fileCount == 1 ? "file" : "files")")
                        .font(Forest.font(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textTertiary)
                    Spacer()
                }
                .padding(.horizontal, Forest.space5)
                .padding(.vertical, Forest.space2)
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
        }
    }

    private var emptyState: some View {
        VStack(spacing: Forest.space3) {
            Spacer().frame(height: Forest.space12)
            Text("What do you want to build?")
                .font(Forest.font(size: Forest.textXl, weight: .semibold))
                .foregroundColor(Forest.textPrimary)
                .tracking(-0.3)
            Text("Describe your app in plain language—AI writes Swift and you preview live.")
                .font(Forest.font(size: Forest.textSm))
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
            if selectedProjectType == .pro {
                runOnDeviceStrip
            }
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
                            .font(Forest.font(size: 10))
                        Text("Mystery app")
                            .font(Forest.font(size: Forest.textXs, weight: .medium))
                    }
                    .foregroundColor(Forest.textTertiary)
                }
                .disabled(blockSendUntilPreflight)

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

    @ViewBuilder
    private var runOnDeviceStrip: some View {
        let checks = preflightChecks
        let loading = preflightLoading
        let showMissing = checks != nil && !loading && (checks!.runner.ok == false || checks!.device.ok == false || checks!.teamId.ok == false)
        VStack(alignment: .leading, spacing: Forest.space2) {
            HStack {
                Text("Run on iPhone")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                Button {
                    runPreflightIfNeeded()
                } label: {
                    Text(loading ? "Checking…" : "Re-check")
                        .font(Forest.font(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.accent)
                }
                .disabled(loading)
            }
            HStack(spacing: Forest.space3) {
                runCheckItem(ok: checks?.runner.ok ?? false, loading: loading, label: "Mac runner")
                runCheckItem(ok: checks?.device.ok ?? false, loading: loading, label: "iPhone")
                runCheckItem(ok: checks?.teamId.ok ?? false, loading: loading, label: "Team ID")
            }
            .font(Forest.font(size: Forest.textXs, weight: .medium))
            if showMissing {
                Text("Complete the checks above to send and run on your iPhone.")
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.warning)
                if checks?.runner.ok == false {
                    Text("On your Mac: run `npm run mac-runner` in the project folder so this phone can build and install.")
                        .font(Forest.font(size: Forest.textXs - 1))
                        .foregroundColor(Forest.textTertiary)
                }
            }
        }
        .padding(.horizontal, Forest.space3)
        .padding(.vertical, Forest.space2)
        .background(Forest.backgroundTertiary.opacity(0.8))
        .cornerRadius(Forest.radiusSm)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusSm)
                .stroke(Forest.border.opacity(0.5), lineWidth: 1)
        )
        .padding(.horizontal, Forest.space4)
    }

    private func runCheckItem(ok: Bool, loading: Bool, label: String) -> some View {
        HStack(spacing: 4) {
            if loading {
                ProgressView()
                    .scaleEffect(0.6)
                    .tint(Forest.textTertiary)
            } else {
                Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(Forest.font(size: 12))
                    .foregroundColor(ok ? Forest.accentLight : Forest.error)
            }
            Text(label)
                .foregroundColor(loading ? Forest.textTertiary : (ok ? Forest.textSecondary : Forest.textPrimary))
        }
    }

    private var inputPill: some View {
        HStack(alignment: .center, spacing: Forest.space2) {
            TextField("Describe your app…", text: $inputText, axis: .vertical)
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($isInputFocused)
                .disabled(blockSendUntilPreflight)
                .submitLabel(canSend ? .send : .done)
                .onSubmit {
                    if canSend {
                        sendIfPossible()
                    } else {
                        isInputFocused = false
                    }
                }

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
                        .font(Forest.font(size: 16, weight: .semibold))
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
                .font(Forest.fontMono(size: 10))
                .foregroundColor(count > maxChars ? Forest.error : Forest.textTertiary)
        }
    }

    private func sendIfPossible() {
        guard canSend else { return }
        HapticService.medium()
        let text = inputText
        inputText = ""
        isInputFocused = false

        justSent = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { justSent = false }

        chatService.sendMessage(text, model: selectedModel.modelValue, projectType: selectedProjectType)
    }
}
