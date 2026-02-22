import SwiftUI

struct ProBuildPreviewView: View {
    let projectId: String
    @ObservedObject var chatService: ChatService
    @State private var isBuildTriggered = false
    @State private var buildError: String?

    var body: some View {
        VStack(spacing: Forest.space6) {
            Spacer()

            statusSection

            actionButtons

            Spacer()

            xcodeExportSection
        }
        .padding(Forest.space4)
        .background(Forest.backgroundPrimary)
    }

    // MARK: - Status

    @ViewBuilder
    private var statusSection: some View {
        switch chatService.buildStatus {
        case .idle:
            idleState
        case .building:
            buildingState
        case .ready:
            readyState
        case .failed(let msg):
            failedState(msg)
        }
    }

    private var idleState: some View {
        VStack(spacing: Forest.space4) {
            Image(systemName: "swift")
                .font(.system(size: 48))
                .foregroundColor(Forest.accent.opacity(0.3))
            Text("Pro (Swift)")
                .font(.system(size: Forest.textXl, weight: .bold))
                .foregroundColor(Forest.textPrimary)
            Text("Send a message to generate your Swift app. Once ready, build and install directly to your device.")
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Forest.space8)
        }
    }

    private var buildingState: some View {
        VStack(spacing: Forest.space4) {
            ZStack {
                Circle()
                    .stroke(Forest.progressTrack, lineWidth: 4)
                    .frame(width: 64, height: 64)
                Circle()
                    .trim(from: 0, to: 0.7)
                    .stroke(
                        LinearGradient(colors: [Forest.accent, Forest.accentLight], startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .frame(width: 64, height: 64)
                    .rotationEffect(.degrees(-90))
                Image(systemName: "hammer.fill")
                    .font(.system(size: 24))
                    .foregroundColor(Forest.accent)
            }
            Text("Building…")
                .font(.system(size: Forest.textLg, weight: .semibold))
                .foregroundColor(Forest.textPrimary)
            Text("Your app is being compiled. You'll get a notification when it's ready.")
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
        }
    }

    private var readyState: some View {
        VStack(spacing: Forest.space4) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(Forest.success)
            Text("Build Ready")
                .font(.system(size: Forest.textXl, weight: .bold))
                .foregroundColor(Forest.textPrimary)
            Text("Your app has been built successfully. Install it on your device or open in Xcode for further development.")
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Forest.space4)
        }
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: Forest.space4) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(Forest.error)
            Text("Build Failed")
                .font(.system(size: Forest.textXl, weight: .bold))
                .foregroundColor(Forest.textPrimary)
            Text(message)
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.error.opacity(0.8))
                .multilineTextAlignment(.center)
                .lineLimit(4)
                .padding(.horizontal, Forest.space4)
        }
    }

    // MARK: - Actions

    @ViewBuilder
    private var actionButtons: some View {
        if chatService.buildStatus == .ready {
            VStack(spacing: Forest.space3) {
                Button {
                    installOnDevice()
                } label: {
                    HStack(spacing: Forest.space2) {
                        Image(systemName: "iphone.and.arrow.forward")
                            .font(.system(size: 16))
                        Text("Install on Device")
                            .font(.system(size: Forest.textBase, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(ForestPrimaryButtonStyle())

                Button {
                    triggerBuild()
                } label: {
                    HStack(spacing: Forest.space2) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14))
                        Text("Rebuild")
                            .font(.system(size: Forest.textSm, weight: .medium))
                    }
                }
                .buttonStyle(ForestSecondaryButtonStyle())
            }
            .padding(.horizontal, Forest.space8)
        } else if chatService.buildStatus == .idle && !chatService.messages.isEmpty {
            Button {
                triggerBuild()
            } label: {
                HStack(spacing: Forest.space2) {
                    Image(systemName: "hammer.fill")
                        .font(.system(size: 14))
                    Text("Build App")
                        .font(.system(size: Forest.textBase, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(ForestPrimaryButtonStyle())
            .padding(.horizontal, Forest.space8)
        }
    }

    // MARK: - Xcode Export

    private var xcodeExportSection: some View {
        VStack(spacing: Forest.space2) {
            Button {
                openInXcode()
            } label: {
                HStack(spacing: Forest.space2) {
                    Image(systemName: "arrow.up.doc")
                        .font(.system(size: 14))
                    Text("Open in Xcode")
                        .font(.system(size: Forest.textSm, weight: .medium))
                }
                .foregroundColor(Forest.accent)
            }
            Text("Download .xcodeproj and open on your Mac")
                .font(.system(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
        }
        .padding(.bottom, Forest.space4)
    }

    // MARK: - Actions

    private func triggerBuild() {
        Task {
            do {
                _ = try await APIService.shared.triggerBuild(projectId: projectId)
                isBuildTriggered = true
            } catch {
                buildError = error.localizedDescription
            }
        }
    }

    private func installOnDevice() {
        Task {
            if let url = await APIService.shared.installManifestURL(projectId: projectId) {
                await UIApplication.shared.open(url)
            }
        }
    }

    private func openInXcode() {
        Task {
            if let url = await APIService.shared.exportXcodeURL(projectId: projectId) {
                await UIApplication.shared.open(url)
            }
        }
    }
}
