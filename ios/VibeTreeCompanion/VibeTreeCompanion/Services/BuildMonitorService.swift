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
    private var liveActivityStartTimes: [String: Date] = [:] // jobId -> when Live Activity began (for stopwatch UX)
    private let pollInterval: TimeInterval = 2.0
    private let pollIntervalIdle: TimeInterval = 5.0
    private let notifiedJobIdsKey = "vibetree_notified_job_ids"
    private let maxNotifiedJobIds = 100

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
                    return self.activeBuilds.isEmpty ? self.pollIntervalIdle : self.pollInterval
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

            notifyForCompletedBuildsIfNeeded(recent: recent)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Show local notification for any completed build we haven't notified for yet (so background fetch or any poll can trigger notifications).
    private func notifyForCompletedBuildsIfNeeded(recent: [BuildJob]) {
        var notifiedIds = UserDefaults.standard.stringArray(forKey: notifiedJobIdsKey) ?? []
        let notifiedSet = Set(notifiedIds)
        for job in recent where job.status.isTerminal {
            guard !notifiedSet.contains(job.id) else { continue }
            if job.status == .succeeded {
                NotificationService.shared.showLocalNotification(
                    title: "Your app is ready!",
                    body: "\(job.projectName) built successfully in \(job.elapsedFormatted)."
                )
            } else {
                NotificationService.shared.showLocalNotification(
                    title: "Build failed",
                    body: "\(job.projectName) failed: \(job.error ?? "Unknown error")"
                )
            }
            notifiedIds.append(job.id)
        }
        if notifiedIds.count > maxNotifiedJobIds {
            notifiedIds = Array(notifiedIds.suffix(maxNotifiedJobIds))
        }
        UserDefaults.standard.set(notifiedIds, forKey: notifiedJobIdsKey)
    }

    // MARK: - Live Activities

    private func updateLiveActivity(for job: BuildJob) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let progress = liveActivityProgress(for: job)
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
            elapsedSeconds: liveActivityElapsedSeconds(for: job),
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

    /// Milestone-based progress for Live Activities.
    /// We keep the in-app list smoother/estimated, but make the Live Activity more "honest" and readable.
    private func liveActivityProgress(for job: BuildJob) -> Double {
        switch job.status {
        case .generating:
            return 0.20
        case .queued:
            return 0.40
        case .running:
            if job.autoFixInProgress == true { return 0.90 }
            let fraction = min(Double(job.elapsedSeconds) / max(30, averageBuildTime), 1.0)
            return min(0.95, 0.45 + fraction * 0.50)
        case .succeeded:
            return 1.0
        case .failed:
            // Keep it near the end but don't jump to 100%.
            return min(0.95, max(0.45, job.estimatedProgress(averageBuildTime: averageBuildTime)))
        }
    }

    private func startLiveActivity(for job: BuildJob, state: BuildActivityAttributes.ContentState) {
        liveActivityStartTimes[job.id] = Date()
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
        liveActivityStartTimes.removeValue(forKey: job.id)

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
        markJobAsNotified(job.id)
    }

    private func liveActivityElapsedSeconds(for job: BuildJob) -> Int {
        // Prefer a "stopwatch since Live Activity appeared" UX (starts near 0 when it shows up).
        // If we don't have a start time yet (before requesting), fall back to job elapsed.
        if let start = liveActivityStartTimes[job.id] {
            return max(0, Int(Date().timeIntervalSince(start)))
        }
        return job.elapsedSeconds
    }

    private func markJobAsNotified(_ jobId: String) {
        var list = UserDefaults.standard.stringArray(forKey: notifiedJobIdsKey) ?? []
        guard !list.contains(jobId) else { return }
        list.append(jobId)
        if list.count > maxNotifiedJobIds { list = Array(list.suffix(maxNotifiedJobIds)) }
        UserDefaults.standard.set(list, forKey: notifiedJobIdsKey)
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
