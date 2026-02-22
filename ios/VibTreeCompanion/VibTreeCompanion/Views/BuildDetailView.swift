import SwiftUI

struct BuildDetailView: View {
    let jobId: String
    @StateObject private var monitor = BuildMonitorService.shared
    @State private var job: BuildJob?
    @State private var isLoading = true

    private var displayJob: BuildJob? {
        job ?? monitor.activeBuilds.first(where: { $0.id == jobId })
            ?? monitor.recentBuilds.first(where: { $0.id == jobId })
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if let job = displayJob {
                    VStack(spacing: Forest.space4) {
                        statusCard(job)
                        progressSection(job)

                        if !job.logs.isEmpty {
                            logsSection(job, proxy: proxy)
                        }

                        if let errors = job.compilerErrors, !errors.isEmpty {
                            errorsSection(errors)
                        }

                        if let error = job.error {
                            errorCard(error)
                        }
                    }
                    .padding(Forest.space4)
                } else if isLoading {
                    VStack(spacing: Forest.space4) {
                        Spacer().frame(height: 100)
                        ProgressView()
                            .tint(Forest.accent)
                        Text("Loading build…")
                            .font(.system(size: Forest.textSm))
                            .foregroundColor(Forest.textSecondary)
                    }
                }
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle(displayJob?.projectName ?? "Build")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await fetchJob()
        }
    }

    private func fetchJob() async {
        defer { isLoading = false }
        do {
            job = try await APIService.shared.fetchBuildJob(id: jobId)
        } catch {
            print("Failed to fetch job: \(error)")
        }
    }

    // MARK: - Status Card

    @ViewBuilder
    private func statusCard(_ job: BuildJob) -> some View {
        HStack(spacing: Forest.space3) {
            Image(systemName: statusIcon(job.status))
                .foregroundColor(statusColor(job.status))
                .font(.system(size: 28))

            VStack(alignment: .leading, spacing: 4) {
                Text(job.stepLabel)
                    .font(.system(size: Forest.textLg, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                HStack(spacing: Forest.space2) {
                    Label(job.elapsedFormatted, systemImage: "clock")
                        .font(.system(size: Forest.textSm, design: .monospaced))
                        .foregroundColor(Forest.textSecondary)
                    if job.attempt > 1 {
                        Text("Attempt \(job.attempt)/\(job.maxAttempts)")
                            .font(.system(size: Forest.textXs, weight: .medium))
                            .foregroundColor(Forest.warning)
                    }
                }
            }
            Spacer()
        }
        .forestCard()
    }

    // MARK: - Progress

    @ViewBuilder
    private func progressSection(_ job: BuildJob) -> some View {
        VStack(spacing: Forest.space2) {
            HStack {
                Text("Progress")
                    .font(.system(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                Text("\(Int(job.estimatedProgress() * 100))%")
                    .font(.system(size: Forest.textSm, weight: .bold, design: .monospaced))
                    .foregroundColor(Forest.accent)
            }
            ProgressView(value: job.estimatedProgress())
                .progressViewStyle(ForestProgressBarStyle(height: 12))
        }
        .forestCard()
    }

    // MARK: - Logs

    @ViewBuilder
    private func logsSection(_ job: BuildJob, proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            HStack {
                Text("Build Logs")
                    .font(.system(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                Text("\(job.logs.count) lines")
                    .font(.system(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
            }

            ScrollView(.vertical) {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(job.logs.suffix(200).enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(logLineColor(line))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(Forest.space3)
            }
            .frame(maxHeight: 300)
            .background(Forest.backgroundPrimary)
            .cornerRadius(Forest.radiusSm)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusSm)
                    .stroke(Forest.border, lineWidth: 1)
            )
        }
        .forestCard()
    }

    private func logLineColor(_ line: String) -> Color {
        if line.contains("error:") || line.contains("Error:") { return Forest.error }
        if line.contains("warning:") || line.contains("Warning:") { return Forest.warning }
        if line.contains("✅") || line.contains("succeeded") { return Forest.success }
        return Forest.textTertiary
    }

    // MARK: - Compiler Errors

    @ViewBuilder
    private func errorsSection(_ errors: [String]) -> some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(Forest.error)
                Text("Compiler Errors (\(errors.count))")
                    .font(.system(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.error)
                Spacer()
            }

            ForEach(Array(errors.enumerated()), id: \.offset) { _, err in
                Text(err)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(Forest.error.opacity(0.9))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Forest.space2)
                    .background(Forest.error.opacity(0.08))
                    .cornerRadius(Forest.radiusSm)
            }
        }
        .forestCard()
    }

    // MARK: - Error Card

    @ViewBuilder
    private func errorCard(_ error: String) -> some View {
        HStack(spacing: Forest.space2) {
            Image(systemName: "xmark.circle.fill")
                .foregroundColor(Forest.error)
            Text(error)
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.error.opacity(0.9))
                .lineLimit(5)
            Spacer()
        }
        .padding(Forest.space3)
        .background(Forest.error.opacity(0.1))
        .cornerRadius(Forest.radiusSm)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusSm)
                .stroke(Forest.error.opacity(0.3), lineWidth: 1)
        )
    }

    private func statusIcon(_ status: BuildJobStatus) -> String {
        switch status {
        case .queued: return "clock.fill"
        case .running: return "hammer.fill"
        case .succeeded: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    private func statusColor(_ status: BuildJobStatus) -> Color {
        switch status {
        case .queued: return Forest.warning
        case .running: return Forest.accent
        case .succeeded: return Forest.success
        case .failed: return Forest.error
        }
    }
}
