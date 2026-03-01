import SwiftUI

/// Holds a pending project ID to open when the user taps a build notification.
/// AppDelegate sets it from notification userInfo; ProjectListView consumes it and navigates.
final class DeepLinkController: ObservableObject {
    static let shared = DeepLinkController()

    @Published var pendingProjectId: String?

    func setPending(projectId: String?) {
        pendingProjectId = projectId
    }

    func clearPending() {
        pendingProjectId = nil
    }
}
