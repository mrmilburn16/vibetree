import ActivityKit
import SwiftUI
import WidgetKit

struct BuildActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BuildActivityAttributes.self) { context in
            lockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.projectName, systemImage: "hammer.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "10B981"))
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    elapsedTimerText(elapsedSeconds: context.state.elapsedSeconds)
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(hex: "FAFAFA"))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        progressBar(progress: context.state.progress, status: context.state.status, stepLabel: context.state.stepLabel)
                        HStack {
                            Text(context.state.stepLabel)
                                .font(.system(size: 12))
                                .foregroundColor(Color(hex: "A1A1AA"))
                                .lineLimit(1)
                            Spacer()
                            statusPill(status: context.state.status, stepLabel: context.state.stepLabel)
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                ZStack {
                    Circle()
                        .stroke(Color(hex: "27272A"), lineWidth: 3)
                        .frame(width: 20, height: 20)
                    Circle()
                        .trim(from: 0, to: context.state.progress)
                        .stroke(progressStrokeColor(status: context.state.status, stepLabel: context.state.stepLabel), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .frame(width: 20, height: 20)
                        .rotationEffect(.degrees(-90))
                }
                // Balance left/right visual margins inside the pill.
                .padding(.leading, 2)
            } compactTrailing: {
                elapsedTimerText(elapsedSeconds: context.state.elapsedSeconds)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(hex: "FAFAFA"))
                    // Balance left/right visual margins inside the pill.
                    .padding(.trailing, 2)
            } minimal: {
                ZStack {
                    Circle()
                        .stroke(Color(hex: "27272A"), lineWidth: 2)
                    Circle()
                        .trim(from: 0, to: context.state.progress)
                        .stroke(progressStrokeColor(status: context.state.status, stepLabel: context.state.stepLabel), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .padding(3)
            }
        }
    }

    // MARK: - Lock Screen Banner

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<BuildActivityAttributes>) -> some View {
        let state = context.state
        let isSuccess = state.status == "succeeded"
        let isFailed = state.status == "failed"
        let cornerRadius: CGFloat = 22

        VStack(spacing: 10) {
            HStack {
                Image(systemName: statusIcon(state.status))
                    .foregroundColor(statusColor(state.status))
                    .font(.system(size: 16, weight: .semibold))
                Text("VibeTree Build")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color(hex: "FAFAFA"))
                Spacer()
                elapsedTimerText(elapsedSeconds: state.elapsedSeconds)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(hex: "A1A1AA"))
            }

            HStack(spacing: 8) {
                Text(context.attributes.projectName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color(hex: "A1A1AA"))
                    .lineLimit(1)
                Spacer()
                statusPill(status: state.status, stepLabel: state.stepLabel)
            }

            progressBar(progress: state.progress, status: state.status, stepLabel: state.stepLabel, height: 10)

            HStack {
                Text(state.stepLabel)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(isSuccess ? Color(hex: "22C55E") : isFailed ? Color(hex: "EF4444") : Color(hex: "A1A1AA"))
                    .lineLimit(1)
                Spacer()
            }

            if state.attempt > 1 {
                HStack {
                    Text("Attempt \(state.attempt)/\(state.maxAttempts)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color(hex: "EAB308"))
                    Spacer()
                }
            }
        }
        .padding(16)
        .background {
            // Liquid Glass: prefer system materials; keep tint subtle so the material can adapt.
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color(hex: "10B981").opacity(0.08))
                        .blendMode(.plusLighter)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.12), lineWidth: 0.5)
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .activityBackgroundTint(.clear)
        .activitySystemActionForegroundColor(Color.white)
    }

    // MARK: - Shared Components

    @ViewBuilder
    private func progressBar(progress: Double, status: String, stepLabel: String, height: CGFloat = 8) -> some View {
        let displayProgress = milestoneProgress(for: status, stepLabel: stepLabel, fallback: progress)
        let showShimmer = shouldShimmer(for: status, stepLabel: stepLabel)

        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(Color.black.opacity(0.28))
                    .overlay(
                        RoundedRectangle(cornerRadius: height / 2)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )

                let fillWidth = max(0, geo.size.width * displayProgress)
                let fillShape = RoundedRectangle(cornerRadius: height / 2)

                if showShimmer {
                    TimelineView(.animation) { timeline in
                        let t = timeline.date.timeIntervalSinceReferenceDate
                        let period = 1.4
                        let phase = CGFloat((t.truncatingRemainder(dividingBy: period)) / period)
                        let shimmerWidth: CGFloat = max(24, geo.size.width * 0.22)
                        let x = (phase * (fillWidth + shimmerWidth)) - shimmerWidth

                        fillShape
                            .fill(
                                LinearGradient(
                                    colors: barColors(status: status, stepLabel: stepLabel, progress: displayProgress),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: fillWidth)
                            .overlay(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.0), Color.white.opacity(0.22), Color.white.opacity(0.0)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                                .frame(width: shimmerWidth)
                                .offset(x: x)
                                .blendMode(.screen)
                            )
                            .clipShape(fillShape)
                    }
                } else {
                    fillShape
                        .fill(
                            LinearGradient(
                                colors: barColors(status: status, stepLabel: stepLabel, progress: displayProgress),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: fillWidth)
                        .animation(.easeInOut(duration: 0.5), value: displayProgress)
                }
            }
        }
        .frame(height: height)
    }

    private func milestoneProgress(for status: String, stepLabel: String, fallback: Double) -> Double {
        if isFixingStep(stepLabel) { return 0.90 }
        switch status {
        case "generating": return 0.20
        case "queued": return 0.40
        case "running": return min(0.95, max(0.45, fallback))
        case "succeeded": return 1.0
        case "failed": return min(0.95, max(0.45, fallback))
        default: return fallback
        }
    }

    private func shouldShimmer(for status: String, stepLabel: String) -> Bool {
        if status == "succeeded" || status == "failed" { return false }
        if status == "running" && !isFixingStep(stepLabel) { return false }
        // Generating / queued / fixing: milestone + subtle shimmer.
        return status == "generating" || status == "queued" || isFixingStep(stepLabel)
    }

    private func isFixingStep(_ stepLabel: String) -> Bool {
        let s = stepLabel.lowercased()
        return s.contains("auto-fix") || s.contains("auto-fixing") || s.contains("auto fixing")
    }

    private func barColors(status: String, stepLabel: String, progress: Double) -> [Color] {
        if status == "failed" {
            return [Color(hex: "EF4444"), Color(hex: "F87171")]
        }
        if status == "succeeded" || progress >= 1.0 {
            return [Color(hex: "22C55E"), Color(hex: "34D399")]
        }
        if isFixingStep(stepLabel) {
            return [Color(hex: "EAB308"), Color(hex: "F59E0B")]
        }
        // Good / in-progress states default to green (including queued).
        return [Color(hex: "10B981"), Color(hex: "34D399")]
    }

    private func progressStrokeColor(status: String, stepLabel: String) -> Color {
        if status == "failed" { return Color(hex: "EF4444") }
        if status == "succeeded" { return Color(hex: "22C55E") }
        if isFixingStep(stepLabel) { return Color(hex: "EAB308") }
        if status == "generating" { return Color(hex: "34D399") }
        return Color(hex: "10B981")
    }

    @ViewBuilder
    private func statusPill(status: String, stepLabel: String) -> some View {
        let isFixing = isFixingStep(stepLabel)
        let label: String = {
            if isFixing { return "Fixing" }
            switch status {
            case "generating": return "Generating"
            case "queued": return "Queued"
            case "running": return "Running"
            case "succeeded": return "Done"
            case "failed": return "Failed"
            default: return status.capitalized
            }
        }()

        let bg: Color = {
            if isFixing { return Color(hex: "EAB308").opacity(0.18) }
            switch status {
            case "succeeded": return Color(hex: "22C55E").opacity(0.18)
            case "failed": return Color(hex: "EF4444").opacity(0.18)
            case "queued": return Color(hex: "10B981").opacity(0.18)
            case "running": return Color(hex: "10B981").opacity(0.18)
            case "generating": return Color(hex: "34D399").opacity(0.18)
            default: return Color(hex: "27272A")
            }
        }()

        let fg: Color = {
            if isFixing { return Color(hex: "EAB308") }
            switch status {
            case "succeeded": return Color(hex: "22C55E")
            case "failed": return Color(hex: "EF4444")
            case "queued": return Color(hex: "10B981")
            case "running": return Color(hex: "10B981")
            case "generating": return Color(hex: "34D399")
            default: return Color(hex: "A1A1AA")
            }
        }()

        Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(fg)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bg)
            .cornerRadius(999)
            .lineLimit(1)
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "generating": return "sparkles"
        case "queued": return "clock.fill"
        case "running": return "hammer.fill"
        case "succeeded": return "checkmark.circle.fill"
        case "failed": return "xmark.circle.fill"
        default: return "circle.fill"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "generating": return Color(hex: "34D399")
        case "queued": return Color(hex: "EAB308")
        case "running": return Color(hex: "10B981")
        case "succeeded": return Color(hex: "22C55E")
        case "failed": return Color(hex: "EF4444")
        default: return Color(hex: "71717A")
        }
    }

    private func formatElapsed(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds)s" }
        return "\(seconds / 60)m \(seconds % 60)s"
    }

    @ViewBuilder
    private func elapsedTimerText(elapsedSeconds: Int) -> some View {
        // Use `.timer` so the elapsed time ticks smoothly every second
        // without requiring frequent Live Activity state updates.
        let startedAt = Date().addingTimeInterval(-Double(max(0, elapsedSeconds)))
        Text(startedAt, style: .timer)
            .monospacedDigit()
    }
}

@main
struct BuildActivityExtensionBundle: WidgetBundle {
    var body: some Widget {
        BuildActivityLiveActivity()
    }
}
