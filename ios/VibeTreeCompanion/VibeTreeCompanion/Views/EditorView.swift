import SwiftUI

struct EditorView: View {
    let project: Project
    var pendingPrompt: String?
    @StateObject private var chatService: ChatService
    @State private var projectDisplayName: String = ""
    @State private var showSettings = false
    @State private var showPreview = false
    @State private var showShare = false
    @State private var showKeyboardHelp = false
    @State private var showInstallSheet = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(project: Project, pendingPrompt: String? = nil) {
        self.project = project
        self.pendingPrompt = pendingPrompt
        _chatService = StateObject(wrappedValue: ChatService(projectId: project.id))
    }

    private var canInstall: Bool {
        if case .ready = chatService.buildStatus { return true }
        return false
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                landscapeLayout
            } else {
                portraitLayout
            }
        }
        .background(
            ZStack {
                Forest.backgroundPrimary
                RadialGradient(
                    colors: [Forest.accent.opacity(0.04), Color.clear],
                    center: .init(x: 0.5, y: 0.45),
                    startRadius: 0,
                    endRadius: 400
                )
                .ignoresSafeArea()
            }
        )
        .navigationTitle(projectDisplayName.isEmpty ? project.name : projectDisplayName)
        .onAppear { projectDisplayName = project.name }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if (project.projectType ?? .pro) == .pro {
                    Button {
                        showInstallSheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "iphone.and.arrow.forward")
                                .font(Forest.font(size: 14))
                            Text("Install")
                                .font(Forest.font(size: 14, weight: .medium))
                        }
                        .foregroundColor(canInstall ? Forest.accent : Forest.textTertiary)
                    }
                    .disabled(!canInstall)
                }

                Button { showShare = true } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(Forest.font(size: 14))
                        .foregroundColor(Forest.textSecondary)
                }

                Button { showSettings = true } label: {
                    Image(systemName: "gearshape")
                        .font(Forest.font(size: 14))
                        .foregroundColor(Forest.textSecondary)
                }

                if sizeClass == .regular {
                    Button { showKeyboardHelp.toggle() } label: {
                        Image(systemName: "keyboard")
                            .font(Forest.font(size: 14))
                            .foregroundColor(Forest.textSecondary)
                    }
                    .popover(isPresented: $showKeyboardHelp) {
                        KeyboardShortcutsPopover()
                    }
                }

                Button { showPreview.toggle() } label: {
                    Image(systemName: showPreview ? "rectangle.leadinghalf.inset.filled" : "rectangle.trailinghalf.inset.filled")
                        .font(Forest.font(size: 14))
                        .foregroundColor(Forest.accent)
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            ProjectSettingsSheet(project: project) { newName, _ in
                projectDisplayName = newName
            }
        }
        .sheet(isPresented: $showShare) {
            ShareSheet(project: project)
        }
        .sheet(isPresented: $showInstallSheet) {
            InstallOnDeviceSheet(projectId: project.id, projectName: projectDisplayName.isEmpty ? project.name : projectDisplayName)
        }
    }

    // MARK: - Portrait

    private var portraitLayout: some View {
        VStack(spacing: 0) {
            if showPreview {
                previewArea
                    .frame(maxHeight: .infinity)

                Divider()
                    .background(Forest.border)
            }

            ChatPanelView(chatService: chatService, projectId: project.id, projectType: project.projectType ?? .pro, pendingPrompt: pendingPrompt)
                .frame(maxHeight: .infinity)
        }
    }

    // MARK: - Landscape (iPad)

    private var landscapeLayout: some View {
        HStack(spacing: 0) {
            ChatPanelView(chatService: chatService, projectId: project.id, projectType: project.projectType ?? .pro, pendingPrompt: pendingPrompt)
                .frame(maxWidth: .infinity)

            Rectangle()
                .fill(Forest.border)
                .frame(width: 1)

            previewArea
                .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Preview Area

    @ViewBuilder
    private var previewArea: some View {
        switch project.projectType ?? .pro {
        case .standard:
            PreviewWebView(projectId: project.id)
        case .pro:
            ProBuildPreviewView(
                projectId: project.id,
                chatService: chatService
            )
        }
    }
}

// MARK: - Keyboard Shortcuts Popover (iPad)

struct KeyboardShortcutsPopover: View {
    private let shortcuts: [(key: String, label: String)] = [
        ("⌘ Return", "Send message"),
        ("⌘ R", "Run on device"),
        ("⌘ S", "Save project"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            Text("Keyboard Shortcuts")
                .font(Forest.font(size: Forest.textSm, weight: .bold))
                .foregroundColor(Forest.textPrimary)

            ForEach(shortcuts, id: \.key) { shortcut in
                HStack {
                    Text(shortcut.key)
                        .font(Forest.fontMono(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Forest.backgroundTertiary)
                        .cornerRadius(4)
                    Spacer()
                    Text(shortcut.label)
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(Forest.textSecondary)
                }
            }
        }
        .padding(Forest.space4)
        .frame(width: 220)
        .background(Forest.backgroundSecondary)
        .presentationCompactAdaptation(.popover)
    }
}
