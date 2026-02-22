import ActivityKit
import Foundation
import SwiftUI

@MainActor
final class BuildMonitorService: ObservableObject {
    static let shared = BuildMonitorService()

    @Published var activeBuilds: [BuildJob] = []
    @Published var recentBuilds: [BuildJob] = []
    @Published var lastError: String?
    @Published var isPolling = false

    private var pollTask: Task<Void, Never>?
    private var liveActivities: [String: String] = [:] // jobId -> activityId
    private let pollInterval: TimeInterval = 2.0

    private var averageBuildTime: TimeInterval {
        let stored = UserDefaults.standard.double(forKey: "averageBuildTime")
        return stored > 0 ? stored : 180
    }

    func startPolling() {
        guard pollTask == nil else { return }
        isPolling = true
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.poll()
                let seconds: TimeInterval = {
                    guard let self else { return 2.0 }
                    return self.activeBuilds.isEmpty ? 10.0 : self.pollInterval
                }()
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
        isPolling = false
    }

    func refreshOnce() async {
        await poll()
    }

    // MARK: - Polling

    private func poll() async {
        do {
            let active = try await APIService.shared.fetchActiveBuilds()
            let recent = try await APIService.shared.fetchRecentBuilds()

            activeBuilds = active
            recentBuilds = recent
            lastError = nil

            for job in active {
                await updateLiveActivity(for: job)
            }

            let activeIds = Set(active.map(\.id))
            for (jobId, _) in liveActivities where !activeIds.contains(jobId) {
                if let finished = recent.first(where: { $0.id == jobId }) {
                    await endLiveActivity(for: finished)
                }
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Live Activities

    private func updateLiveActivity(for job: BuildJob) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let progress = job.estimatedProgress(averageBuildTime: averageBuildTime)
        let estimatedLeft: Int? = {
            guard !job.status.isTerminal else { return nil }
            let elapsed = job.elapsedSeconds
            let total = Int(averageBuildTime)
            let remaining = max(0, total - elapsed)
            return remaining > 0 ? remaining : nil
        }()

        let state = BuildActivityAttributes.ContentState(
            status: job.status.rawValue,
            progress: progress,
            elapsedSeconds: job.elapsedSeconds,
            stepLabel: job.stepLabel,
            estimatedSecondsLeft: estimatedLeft,
            attempt: job.attempt,
            maxAttempts: job.maxAttempts
        )

        if liveActivities[job.id] != nil {
            for activity in Activity<BuildActivityAttributes>.activities where activity.attributes.jobId == job.id {
                await activity.update(
                    ActivityContent(state: state, staleDate: Date().addingTimeInterval(10))
                )
            }
        } else {
            startLiveActivity(for: job, state: state)
        }
    }

    private func startLiveActivity(for job: BuildJob, state: BuildActivityAttributes.ContentState) {
        let attributes = BuildActivityAttributes(
            jobId: job.id,
            projectName: job.projectName
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(10))

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            liveActivities[job.id] = activity.id
        } catch {
            print("Failed to start Live Activity: \(error)")
        }
    }

    private func endLiveActivity(for job: BuildJob) async {
        let finalState = BuildActivityAttributes.ContentState(
            status: job.status.rawValue,
            progress: job.status == .succeeded ? 1.0 : job.estimatedProgress(averageBuildTime: averageBuildTime),
            elapsedSeconds: job.elapsedSeconds,
            stepLabel: job.stepLabel,
            estimatedSecondsLeft: nil,
            attempt: job.attempt,
            maxAttempts: job.maxAttempts
        )
        let content = ActivityContent(state: finalState, staleDate: nil)

        for activity in Activity<BuildActivityAttributes>.activities where activity.attributes.jobId == job.id {
            await activity.end(content, dismissalPolicy: .after(.now + 300))
        }
        liveActivities.removeValue(forKey: job.id)

        if job.status == .succeeded {
            recordBuildTime(job.elapsedSeconds)
        }

        if job.status == .succeeded {
            NotificationService.shared.showLocalNotification(
                title: "Your app is ready!",
                body: "\(job.projectName) built successfully in \(job.elapsedFormatted)."
            )
        } else if job.status == .failed {
            NotificationService.shared.showLocalNotification(
                title: "Build failed",
                body: "\(job.projectName) failed: \(job.error ?? "Unknown error")"
            )
        }
    }

    private func recordBuildTime(_ seconds: Int) {
        let key = "buildDurations"
        var durations = UserDefaults.standard.array(forKey: key) as? [Double] ?? []
        durations.append(Double(seconds))
        if durations.count > 20 { durations = Array(durations.suffix(20)) }
        UserDefaults.standard.set(durations, forKey: key)

        let avg = durations.reduce(0, +) / Double(durations.count)
        UserDefaults.standard.set(avg, forKey: "averageBuildTime")
    }
}
