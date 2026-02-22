import SwiftUI

struct EditorView: View {
    let project: Project
    @StateObject private var chatService: ChatService
    @State private var showSettings = false
    @State private var showPreview = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    init(project: Project) {
        self.project = project
        _chatService = StateObject(wrappedValue: ChatService(projectId: project.id))
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                landscapeLayout
            } else {
                portraitLayout
            }
        }
        .background(Forest.backgroundPrimary)
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 14))
                        .foregroundColor(Forest.textSecondary)
                }

                Button {
                    showPreview.toggle()
                } label: {
                    Image(systemName: showPreview ? "rectangle.leadinghalf.inset.filled" : "rectangle.trailinghalf.inset.filled")
                        .font(.system(size: 14))
                        .foregroundColor(Forest.accent)
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            ProjectSettingsSheet(project: project)
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

            ChatPanelView(chatService: chatService, projectType: project.projectType)
                .frame(maxHeight: .infinity)
        }
    }

    // MARK: - Landscape (iPad)

    private var landscapeLayout: some View {
        HStack(spacing: 0) {
            ChatPanelView(chatService: chatService, projectType: project.projectType)
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
        switch project.projectType {
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
