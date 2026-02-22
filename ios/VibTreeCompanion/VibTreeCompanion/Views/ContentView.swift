import SwiftUI

struct ContentView: View {
    @StateObject private var monitor = BuildMonitorService.shared
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space4) {
                    if let error = monitor.lastError {
                        errorBanner(error)
                    }

                    if !monitor.activeBuilds.isEmpty {
                        sectionHeader("Active Builds")
                        ForEach(monitor.activeBuilds) { job in
                            NavigationLink(destination: BuildDetailView(jobId: job.id)) {
                                ActiveBuildCard(job: job)
                            }
                            .buttonStyle(.plain)
                        }
                    } else if monitor.isPolling {
                        emptyState
                    }

                    if !monitor.recentBuilds.isEmpty {
                        sectionHeader("Recent Builds")
                        ForEach(monitor.recentBuilds) { job in
                            NavigationLink(destination: BuildDetailView(jobId: job.id)) {
                                RecentBuildRow(job: job)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, Forest.space4)
                .padding(.top, Forest.space2)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("VibTree")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showSettings = true }) {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(Forest.accent)
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .refreshable {
                await monitor.refreshOnce()
            }
            .onAppear {
                monitor.startPolling()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Components

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textTertiary)
                .textCase(.uppercase)
                .tracking(0.8)
            Spacer()
        }
        .padding(.top, Forest.space4)
        .padding(.bottom, Forest.space1)
    }

    @ViewBuilder
    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Forest.space2) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Forest.warning)
            Text(message)
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textSecondary)
                .lineLimit(2)
            Spacer()
        }
        .padding(Forest.space3)
        .background(Forest.warning.opacity(0.1))
        .cornerRadius(Forest.radiusSm)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusSm)
                .stroke(Forest.warning.opacity(0.3), lineWidth: 1)
        )
    }

    private var emptyState: some View {
        VStack(spacing: Forest.space4) {
            Spacer().frame(height: 80)
            Image(systemName: "hammer.fill")
                .font(.system(size: 48))
                .foregroundColor(Forest.accent.opacity(0.3))
            Text("No active builds")
                .font(.system(size: Forest.textLg, weight: .semibold))
                .foregroundColor(Forest.textSecondary)
            Text("Start a build in the web app and it will appear here")
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
    }
}

// MARK: - Active Build Card

struct ActiveBuildCard: View {
    let job: BuildJob

    private var progress: Double {
        job.estimatedProgress()
    }

    var body: some View {
        VStack(spacing: Forest.space3) {
            HStack {
                Image(systemName: statusIcon)
                    .foregroundColor(statusColor)
                    .font(.system(size: 16, weight: .semibold))
                Text(job.projectName)
                    .font(.system(size: Forest.textBase, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                    .lineLimit(1)
                Spacer()
                Text(job.elapsedFormatted)
                    .font(.system(size: Forest.textSm, weight: .medium, design: .monospaced))
                    .foregroundColor(Forest.textSecondary)
            }

            ProgressView(value: progress)
                .progressViewStyle(ForestProgressBarStyle(height: 10))

            HStack {
                Text(job.stepLabel)
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.textSecondary)
                    .lineLimit(1)
                Spacer()
                if !job.status.isTerminal {
                    let avgTime = UserDefaults.standard.double(forKey: "averageBuildTime")
                    let est = avgTime > 0 ? avgTime : 180
                    let remaining = max(0, Int(est) - job.elapsedSeconds)
                    if remaining > 0 {
                        Text("~\(formatTime(remaining)) left")
                            .font(.system(size: Forest.textXs))
                            .foregroundColor(Forest.textTertiary)
                    }
                }
            }

            if job.attempt > 1 {
                HStack {
                    Text("Attempt \(job.attempt)/\(job.maxAttempts)")
                        .font(.system(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.warning)
                    Spacer()
                }
            }
        }
        .forestCard()
    }

    private var statusIcon: String {
        switch job.status {
        case .queued: return "clock.fill"
        case .running: return "hammer.fill"
        case .succeeded: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch job.status {
        case .queued: return Forest.warning
        case .running: return Forest.accent
        case .succeeded: return Forest.success
        case .failed: return Forest.error
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        return "\(seconds / 60)m \(seconds % 60)s"
    }
}

// MARK: - Recent Build Row

struct RecentBuildRow: View {
    let job: BuildJob

    var body: some View {
        HStack(spacing: Forest.space3) {
            Image(systemName: job.status == .succeeded ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(job.status == .succeeded ? Forest.success : Forest.error)
                .font(.system(size: 20))

            VStack(alignment: .leading, spacing: 2) {
                Text(job.projectName)
                    .font(.system(size: Forest.textBase, weight: .semibold))
                    .foregroundColor(Forest.textPrimary)
                    .lineLimit(1)
                HStack(spacing: Forest.space2) {
                    Text(job.elapsedFormatted)
                        .font(.system(size: Forest.textXs, design: .monospaced))
                        .foregroundColor(Forest.textTertiary)
                    if job.attempt > 1 {
                        Text("(\(job.attempt) attempts)")
                            .font(.system(size: Forest.textXs))
                            .foregroundColor(Forest.warning)
                    }
                    Text(formattedDate)
                        .font(.system(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundColor(Forest.textTertiary)
        }
        .padding(Forest.space3)
        .background(Forest.backgroundSecondary)
        .cornerRadius(Forest.radiusSm)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusSm)
                .stroke(Forest.border, lineWidth: 1)
        )
    }

    private var formattedDate: String {
        let date = Date(timeIntervalSince1970: (job.finishedAt ?? job.createdAt) / 1000)
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
