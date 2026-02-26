import SwiftUI

struct BuildDetailView: View {
    let jobId: String
    @StateObject private var monitor = BuildMonitorService.shared
    @State private var job: BuildJob?
    @State private var isLoading = true
    @State private var compilerErrorsCopied = false

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
                            errorsSection(errors, copied: $compilerErrorsCopied)
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
                            .font(Forest.font(size: Forest.textSm))
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
                .font(Forest.font(size: 28))

            VStack(alignment: .leading, spacing: 4) {
                Text(job.stepLabel)
                    .font(Forest.font(size: Forest.textLg, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                HStack(spacing: Forest.space2) {
                    Label(job.elapsedFormatted, systemImage: "clock")
                        .font(Forest.fontMono(size: Forest.textSm))
                        .foregroundColor(Forest.textSecondary)
                    if job.attempt > 1 {
                        Text("Attempt \(job.attempt)/\(job.maxAttempts)")
                            .font(Forest.font(size: Forest.textXs, weight: .medium))
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
                    .font(Forest.font(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                Text("\(Int(job.estimatedProgress() * 100))%")
                    .font(Forest.fontMono(size: Forest.textSm, weight: .bold))
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
                    .font(Forest.font(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                Text("\(job.logs.count) lines")
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
            }

            ScrollView(.vertical) {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(job.logs.suffix(200).enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(Forest.fontMono(size: 11))
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
    private func errorsSection(_ errors: [String], copied: Binding<Bool>) -> some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(Forest.error)
                Text("Compiler Errors (\(errors.count))")
                    .font(Forest.font(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.error)
                Spacer()
                Button {
                    let text = errors.joined(separator: "\n\n")
                    UIPasteboard.general.string = text
                    copied.wrappedValue = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        copied.wrappedValue = false
                    }
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(Forest.font(size: 14))
                        .foregroundColor(Forest.textSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy all errors")
                if copied.wrappedValue {
                    Text("Copied!")
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                }
            }

            ForEach(Array(errors.enumerated()), id: \.offset) { _, err in
                Text(err)
                    .font(Forest.fontMono(size: 11))
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
                .font(Forest.font(size: Forest.textSm))
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
        case .generating: return "sparkles"
        case .queued: return "clock.fill"
        case .running: return "hammer.fill"
        case .succeeded: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    private func statusColor(_ status: BuildJobStatus) -> Color {
        switch status {
        case .generating: return Forest.accentLight
        case .queued: return Forest.warning
        case .running: return Forest.accent
        case .succeeded: return Forest.success
        case .failed: return Forest.error
        }
    }
}
