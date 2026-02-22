import Foundation

enum BuildJobStatus: String, Codable, CaseIterable {
    case queued
    case running
    case succeeded
    case failed

    var isTerminal: Bool {
        self == .succeeded || self == .failed
    }
}

struct BuildJobRequest: Codable {
    let projectId: String
    let projectName: String
    let bundleId: String
    let autoFix: Bool?
    let attempt: Int?
    let maxAttempts: Int?
    let parentJobId: String?
}

struct BuildJob: Codable, Identifiable {
    let id: String
    let createdAt: Double
    var startedAt: Double?
    var finishedAt: Double?
    var status: BuildJobStatus
    var runnerId: String?
    let request: BuildJobRequest
    var logs: [String]
    var exitCode: Int?
    var error: String?
    var compilerErrors: [String]?
    var nextJobId: String?
    var autoFixInProgress: Bool?

    var projectName: String { request.projectName }
    var attempt: Int { request.attempt ?? 1 }
    var maxAttempts: Int { request.maxAttempts ?? 5 }

    var elapsedSeconds: Int {
        let start = startedAt ?? createdAt
        let end = finishedAt ?? (Date().timeIntervalSince1970 * 1000)
        return max(0, Int((end - start) / 1000))
    }

    var elapsedFormatted: String {
        let s = elapsedSeconds
        if s < 60 { return "\(s)s" }
        return "\(s / 60)m \(s % 60)s"
    }

    var stepLabel: String {
        switch status {
        case .queued:
            return "Waiting for runner…"
        case .running:
            if autoFixInProgress == true {
                return "Auto-fixing errors… (attempt \(attempt)/\(maxAttempts))"
            }
            if attempt > 1 {
                return "Rebuilding after fix… (attempt \(attempt)/\(maxAttempts))"
            }
            return "Building with xcodebuild…"
        case .succeeded:
            return "Build succeeded"
        case .failed:
            return "Build failed"
        }
    }

    /// Estimated progress 0.0 – 1.0 based on status and elapsed time
    func estimatedProgress(averageBuildTime: TimeInterval = 180) -> Double {
        switch status {
        case .queued:
            let t = min(Double(elapsedSeconds) / 30.0, 1.0)
            return t * 0.10
        case .running:
            if autoFixInProgress == true {
                return 0.90
            }
            let buildElapsed = Double(elapsedSeconds)
            let fraction = min(buildElapsed / averageBuildTime, 1.0)
            return 0.10 + fraction * 0.75
        case .succeeded:
            return 1.0
        case .failed:
            let buildElapsed = Double(elapsedSeconds)
            let fraction = min(buildElapsed / averageBuildTime, 1.0)
            return 0.10 + fraction * 0.75
        }
    }
}

struct BuildJobResponse: Codable {
    let job: BuildJob?
}

struct ActiveBuildJobsResponse: Codable {
    let jobs: [BuildJob]
}
