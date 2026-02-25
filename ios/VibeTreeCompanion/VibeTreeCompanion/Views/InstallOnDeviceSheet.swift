import SwiftUI
import os.log

private let logger = Logger(subsystem: "com.vibetree.companion", category: "InstallOnDevice")

/// Sheet shown when user taps "Install on iPhone" from the editor. Builds on Mac and installs via devicectl.
struct InstallOnDeviceSheet: View {
    let projectId: String
    let projectName: String
    @Environment(\.dismiss) private var dismiss

    @State private var installJobId: String?
    @State private var installStatus: String?
    @State private var installLogTail: [String] = []
    @State private var installPolling = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: Forest.space6) {
                if installStatus == "succeeded" {
                    VStack(spacing: Forest.space3) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(Forest.success)
                        Text("Installed & launched on your iPhone!")
                            .font(.system(size: Forest.textLg, weight: .semibold))
                            .foregroundColor(Forest.textPrimary)
                            .multilineTextAlignment(.center)
                        Text("Check your phone — the app should be open.")
                            .font(.system(size: Forest.textSm))
                            .foregroundColor(Forest.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if installStatus == "failed" {
                    VStack(spacing: Forest.space3) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(Forest.error)
                        Text("Install failed")
                            .font(.system(size: Forest.textLg, weight: .semibold))
                            .foregroundColor(Forest.textPrimary)
                        if let err = errorMessage {
                            Text(err)
                                .font(.system(size: Forest.textSm))
                                .foregroundColor(Forest.textSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        Text("Connect your iPhone to your Mac with a cable and try again.")
                            .font(.system(size: Forest.textXs))
                            .foregroundColor(Forest.textTertiary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    VStack(spacing: Forest.space5) {
                        Image(systemName: "iphone.and.arrow.forward")
                            .font(.system(size: 44))
                            .foregroundColor(Forest.accent)

                        Text("Install on iPhone")
                            .font(.system(size: Forest.textXl, weight: .bold))
                            .foregroundColor(Forest.textPrimary)

                        Text("Your Mac will build the app and install it on your connected iPhone. Make sure your phone is plugged in via USB.")
                            .font(.system(size: Forest.textSm))
                            .foregroundColor(Forest.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        if installPolling {
                            VStack(spacing: Forest.space3) {
                                ProgressView()
                                    .tint(Forest.accent)
                                    .scaleEffect(1.2)
                                Text(installStatus == "queued" ? "Waiting for build runner…" : "Building & installing…")
                                    .font(.system(size: Forest.textSm))
                                    .foregroundColor(Forest.textSecondary)
                                if !installLogTail.isEmpty {
                                    Text(installLogTail.suffix(3).joined(separator: "\n"))
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(Forest.textTertiary)
                                        .lineLimit(5)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(Forest.space3)
                                        .background(Forest.backgroundSecondary)
                                        .cornerRadius(Forest.radiusSm)
                                }
                            }
                            .padding(.top, Forest.space4)
                        } else {
                            Button {
                                startInstall()
                            } label: {
                                HStack(spacing: Forest.space2) {
                                    Image(systemName: "iphone.and.arrow.forward")
                                        .font(.system(size: 18))
                                    Text("Install on iPhone")
                                        .font(.system(size: Forest.textBase, weight: .semibold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Forest.space4)
                            }
                            .buttonStyle(ForestPrimaryButtonStyle())
                            .padding(.top, Forest.space4)
                            .padding(.horizontal, Forest.space8)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding(Forest.space6)
            .background(Forest.backgroundPrimary)
            .navigationTitle("Install on iPhone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(Forest.accent)
                }
            }
        }
    }

    private func startInstall() {
        guard !installPolling else { return }
        installPolling = true
        installStatus = "queued"
        installLogTail = []
        errorMessage = nil

        Task {
            do {
                let jobId = try await APIService.shared.triggerDeviceInstall(projectId: projectId)
                installJobId = jobId
                logger.info("Install job created: \(jobId)")
                await pollInstallJob(jobId: jobId)
            } catch {
                logger.error("Install failed: \(error.localizedDescription)")
                installStatus = "failed"
                errorMessage = error.localizedDescription
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
                    await MainActor.run {
                        installPolling = false
                        if status == "failed", let err = job.error {
                            errorMessage = err
                        }
                    }
                    return
                }
            } catch {
                logger.error("Poll error: \(error.localizedDescription)")
            }
        }
    }
}
