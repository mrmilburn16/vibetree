import SwiftUI
import os.log

private let logger = Logger(subsystem: "com.vibetree.companion", category: "ProBuildPreview")

struct ProBuildPreviewView: View {
    let projectId: String
    @ObservedObject var chatService: ChatService
    @State private var isBuildTriggered = false
    @State private var buildError: String?
    @State private var installJobId: String?
    @State private var installStatus: String?
    @State private var installLogTail: [String] = []
    @State private var installPolling = false

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
                        if installPolling {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "iphone.and.arrow.forward")
                                .font(.system(size: 16))
                        }
                        Text(installButtonLabel)
                            .font(.system(size: Forest.textBase, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(ForestPrimaryButtonStyle())
                .disabled(installPolling)

                if let status = installStatus {
                    VStack(alignment: .leading, spacing: Forest.space2) {
                        HStack(spacing: Forest.space2) {
                            if status == "succeeded" {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Forest.success)
                                    .font(.system(size: 14))
                                Text("Installed & launched on your iPhone!")
                                    .font(.system(size: Forest.textSm, weight: .medium))
                                    .foregroundColor(Forest.success)
                            } else if status == "failed" {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: Forest.space2) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(Forest.error)
                                            .font(.system(size: 14))
                                        Text("Install failed")
                                            .font(.system(size: Forest.textSm, weight: .medium))
                                            .foregroundColor(Forest.error)
                                    }
                                    if let err = buildError {
                                        Text(err)
                                            .font(.system(size: Forest.textXs))
                                            .foregroundColor(Forest.textSecondary)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            } else {
                                ProgressView()
                                    .tint(Forest.accent)
                                    .scaleEffect(0.6)
                                Text(status == "queued" ? "Waiting for build runner…" : "Building & installing…")
                                    .font(.system(size: Forest.textSm))
                                    .foregroundColor(Forest.textSecondary)
                            }
                        }

                        if !installLogTail.isEmpty {
                            Text(installLogTail.suffix(3).joined(separator: "\n"))
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(Forest.textTertiary)
                                .lineLimit(3)
                        }
                    }
                    .padding(Forest.space3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Forest.backgroundSecondary)
                    .cornerRadius(Forest.radiusSm)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusSm)
                            .stroke(Forest.border, lineWidth: 1)
                    )
                }

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

    private var installButtonLabel: String {
        if installPolling { return "Installing…" }
        if installStatus == "succeeded" { return "Re-install on Device" }
        return "Install on Device"
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
        guard !installPolling else { return }
        installPolling = true
        installStatus = "queued"
        installLogTail = []
        buildError = nil

        Task {
            do {
                let jobId = try await APIService.shared.triggerDeviceInstall(projectId: projectId)
                installJobId = jobId
                logger.info("Install job created: \(jobId)")
                await pollInstallJob(jobId: jobId)
            } catch {
                logger.error("Install failed: \(error.localizedDescription)")
                installStatus = "failed"
                buildError = error.localizedDescription
                installPolling = false
            }
        }
    }

    private func pollInstallJob(jobId: String) async {
        var currentJobId = jobId
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            do {
                let job = try await APIService.shared.fetchBuildJob(id: currentJobId)
                guard let job else { continue }

                let status = job.status.rawValue
                let logs = job.logs

                await MainActor.run {
                    installLogTail = Array(logs.suffix(5))
                }

                if status == "failed", let next = job.nextJobId {
                    currentJobId = next
                    await MainActor.run { installJobId = next }
                    continue
                }

                await MainActor.run { installStatus = status }

                if status == "succeeded" || status == "failed" {
                    await MainActor.run { installPolling = false }
                    return
                }
            } catch {
                logger.error("Poll error: \(error.localizedDescription)")
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
