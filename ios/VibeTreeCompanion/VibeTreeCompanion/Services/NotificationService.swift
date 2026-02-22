import Foundation
import UserNotifications
import UIKit

@MainActor
final class NotificationService: NSObject, ObservableObject {
    static let shared = NotificationService()

    @Published var isAuthorized = false
    @Published var deviceToken: String?

    override init() {
        super.init()
    }

    func requestPermission() async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            print("Notification permission error: \(error)")
        }
    }

    func handleDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = tokenString
        UserDefaults.standard.set(tokenString, forKey: "apnsDeviceToken")

        Task {
            try? await APIService.shared.registerDevice(token: tokenString)
        }
    }

    func reregisterIfPossible() {
        guard let token = UserDefaults.standard.string(forKey: "apnsDeviceToken"), !token.isEmpty else { return }
        Task {
            try? await APIService.shared.registerDevice(token: token)
        }
    }

    func handleRegistrationError(_ error: Error) {
        print("APNs registration failed: \(error)")
    }

    func showLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}
