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
                    Text(formatElapsed(context.state.elapsedSeconds))
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(hex: "FAFAFA"))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        progressBar(progress: context.state.progress)
                        HStack {
                            Text(context.state.stepLabel)
                                .font(.system(size: 12))
                                .foregroundColor(Color(hex: "A1A1AA"))
                                .lineLimit(1)
                            Spacer()
                            if let remaining = context.state.estimatedSecondsLeft, remaining > 0 {
                                Text("~\(formatElapsed(remaining)) left")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(hex: "71717A"))
                            }
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
                        .stroke(Color(hex: "10B981"), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .frame(width: 20, height: 20)
                        .rotationEffect(.degrees(-90))
                }
            } compactTrailing: {
                Text(formatElapsed(context.state.elapsedSeconds))
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(hex: "FAFAFA"))
            } minimal: {
                ZStack {
                    Circle()
                        .stroke(Color(hex: "27272A"), lineWidth: 2)
                    Circle()
                        .trim(from: 0, to: context.state.progress)
                        .stroke(Color(hex: "10B981"), style: StrokeStyle(lineWidth: 2, lineCap: .round))
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

        VStack(spacing: 10) {
            HStack {
                Image(systemName: statusIcon(state.status))
                    .foregroundColor(statusColor(state.status))
                    .font(.system(size: 16, weight: .semibold))
                Text("VibTree Build")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color(hex: "FAFAFA"))
                Spacer()
                Text(formatElapsed(state.elapsedSeconds))
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundColor(Color(hex: "A1A1AA"))
            }

            progressBar(progress: state.progress, height: 10)

            HStack {
                Text(state.stepLabel)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(isSuccess ? Color(hex: "22C55E") : isFailed ? Color(hex: "EF4444") : Color(hex: "A1A1AA"))
                    .lineLimit(1)
                Spacer()
                if let remaining = state.estimatedSecondsLeft, remaining > 0, !isSuccess, !isFailed {
                    Text("~\(formatElapsed(remaining)) left")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "71717A"))
                }
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
        .background(Color(hex: "141416"))
        .activityBackgroundTint(Color(hex: "141416"))
    }

    // MARK: - Shared Components

    @ViewBuilder
    private func progressBar(progress: Double, height: CGFloat = 8) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(Color(hex: "27272A"))
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(
                        LinearGradient(
                            colors: progressColors(progress),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(0, geo.size.width * progress))
                    .animation(.easeInOut(duration: 0.5), value: progress)
            }
        }
        .frame(height: height)
    }

    private func progressColors(_ progress: Double) -> [Color] {
        if progress >= 1.0 {
            return [Color(hex: "22C55E"), Color(hex: "34D399")]
        }
        return [Color(hex: "10B981"), Color(hex: "34D399")]
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "queued": return "clock.fill"
        case "running": return "hammer.fill"
        case "succeeded": return "checkmark.circle.fill"
        case "failed": return "xmark.circle.fill"
        default: return "circle.fill"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
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
}

struct BuildActivityExtensionBundle: WidgetBundle {
    var body: some Widget {
        BuildActivityLiveActivity()
    }
}
