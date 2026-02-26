import Foundation

/// Run-on-iPhone readiness checks from GET /api/macos/preflight
struct PreflightResponse: Codable {
    let runner: Check
    let device: Check
    let teamId: TeamIdCheck
    let files: FileCheck

    struct Check: Codable {
        let ok: Bool
    }

    struct TeamIdCheck: Codable {
        let ok: Bool
    }

    struct FileCheck: Codable {
        let ok: Bool
        let count: Int?
    }

    var runOnDeviceReady: Bool {
        runner.ok && device.ok && teamId.ok
    }
}
