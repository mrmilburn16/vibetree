import SwiftUI

struct ChatPanelView: View {
    @ObservedObject var chatService: ChatService
    let projectType: ProjectType

    @State private var inputText = ""
    @State private var selectedModel: LLMOption = .defaultOption
    @State private var selectedProjectType: ProjectType = .pro
    @State private var justSent = false

    private let maxChars = 4000

    private var canSend: Bool {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= maxChars && !chatService.isStreaming
    }

    var body: some View {
        VStack(spacing: 0) {
            messageList
            toolbarRow
            inputBar
        }
        .onAppear {
            selectedProjectType = projectType
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Forest.space3) {
                    ForEach(chatService.messages) { message in
                        MessageBubbleView(message: message)
                            .id(message.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(Forest.space4)
            }
            .onChange(of: chatService.messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onChange(of: chatService.messages.last?.text) { _, _ in
                proxy.scrollTo("bottom", anchor: .bottom)
            }
        }
    }

    // MARK: - Toolbar (LLM + Project Type)

    private var toolbarRow: some View {
        HStack(spacing: Forest.space2) {
            Menu {
                ForEach(LLMOption.options) { option in
                    Button {
                        selectedModel = option
                    } label: {
                        HStack {
                            Text(option.label)
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

    private var buildStatusBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
            Text(chatService.buildStatus.label)
                .font(.system(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
        }
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

    private var inputBar: some View {
        HStack(alignment: .center, spacing: Forest.space2) {
            TextField("Describe your app…", text: $inputText, axis: .vertical)
                .font(.system(size: Forest.textBase))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .onSubmit { sendIfPossible() }

            sendButton
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space2)
        .background(Forest.inputBg)
        .cornerRadius(26)
        .overlay(
            RoundedRectangle(cornerRadius: 26)
                .stroke(Forest.inputBorder, lineWidth: 2)
        )
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
        .scaleEffect(justSent ? 0.92 : 1.0)
        .animation(.easeOut(duration: 0.1), value: justSent)
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
