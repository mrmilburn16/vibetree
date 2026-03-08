import SwiftUI

/// Wraps MainTabView and presents EditorView as a full-screen cover when the user taps a build notification (deep link).
/// This skips the Projects tab and opens the project's editor directly.
struct AuthenticatedRootView: View {
    @EnvironmentObject private var deepLink: DeepLinkController
    @State private var deepLinkProject: Project?

    var body: some View {
        MainTabView()
            .fullScreenCover(item: $deepLinkProject, onDismiss: {
                deepLinkProject = nil
                deepLink.clearPending()
            }) { project in
                EditorView(project: project, pendingPrompt: nil)
            }
            .task(id: deepLink.pendingProjectId) {
                guard let projectId = deepLink.pendingProjectId, !projectId.isEmpty else { return }
                let serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
                print("[DeepLink] task running for projectId:", projectId, "serverURL:", serverURL)
                do {
                    let project = try await APIService.shared.fetchProject(id: projectId)
                    print("[DeepLink] fetchProject succeeded, presenting cover for:", project.name)
                    // Brief delay so the window is active when presenting (fixes cold start from notification tap).
                    try? await Task.sleep(nanoseconds: 250_000_000) // 0.25s
                    await MainActor.run {
                        deepLinkProject = project
                    }
                } catch {
                    print("[DeepLink] fetchProject failed:", error)
                    await MainActor.run {
                        deepLink.clearPending()
                    }
                }
            }
    }
}
