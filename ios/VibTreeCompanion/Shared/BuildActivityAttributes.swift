import ActivityKit
import Foundation

struct BuildActivityAttributes: ActivityAttributes {
    /// Fixed context that doesn't change during the activity
    let jobId: String
    let projectName: String

    struct ContentState: Codable, Hashable {
        let status: String          // "queued" | "running" | "succeeded" | "failed"
        let progress: Double        // 0.0 – 1.0
        let elapsedSeconds: Int
        let stepLabel: String
        let estimatedSecondsLeft: Int?
        let attempt: Int
        let maxAttempts: Int
    }
}
