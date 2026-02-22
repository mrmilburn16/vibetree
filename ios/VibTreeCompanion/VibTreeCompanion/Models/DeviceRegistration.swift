import Foundation

struct DeviceRegistration: Codable {
    let deviceToken: String
    let activityPushToken: String?
}
