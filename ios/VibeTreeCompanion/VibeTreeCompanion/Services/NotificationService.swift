import Foundation
import UserNotifications
import UIKit

@MainActor
final class NotificationService: NSObject, ObservableObject {
    static let shared = NotificationService()

    @Published var isAuthorized = false
    @Published var deviceToken: String?
    /// Last server registration result: true = success, false = failure (see lastRegistrationError).
    @Published var lastRegistrationSuccess: Bool?
    @Published var lastRegistrationError: String?
    @Published var isRegistering = false
    /// When Apple rejects push registration, iOS calls didFailToRegister; we store it here so the UI can show the real reason.
    @Published var apnsRegistrationError: String?

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
                // Token is delivered asynchronously; poll for up to ~20s and register when it arrives.
                await waitForTokenAndRegister()
            }
        } catch {
            print("Notification permission error: \(error)")
        }
    }

    /// After permission granted, wait for APNs to deliver the device token and register with server (up to ~20s).
    private func waitForTokenAndRegister() async {
        for _ in 0..<10 {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            let token = UserDefaults.standard.string(forKey: "apnsDeviceToken")
            if let token, !token.isEmpty {
                await registerWithServer(token: token)
                return
            }
        }
    }

    func handleDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = tokenString
        UserDefaults.standard.set(tokenString, forKey: "apnsDeviceToken")

        Task {
            await registerWithServer(token: tokenString)
        }
    }

    /// Registers the given token (or the stored token if nil) with the app’s server. Updates lastRegistrationSuccess and lastRegistrationError.
    /// If no token is stored but notifications are enabled, asks iOS for the token again and waits for it before registering.
    func registerWithServer(token: String? = nil) async {
        isRegistering = true
        lastRegistrationError = nil
        apnsRegistrationError = nil
        defer { isRegistering = false }

        var tokenToUse = token ?? UserDefaults.standard.string(forKey: "apnsDeviceToken")
        if (tokenToUse ?? "").isEmpty, isAuthorized {
            lastRegistrationError = "Requesting token from Apple…"
            UIApplication.shared.registerForRemoteNotifications()
            await waitForTokenAndRegister()
            tokenToUse = UserDefaults.standard.string(forKey: "apnsDeviceToken")
        }
        guard let t = tokenToUse, !t.isEmpty else {
            lastRegistrationSuccess = false
            if let apnsErr = apnsRegistrationError, !apnsErr.isEmpty {
                lastRegistrationError = "Apple: \(apnsErr)"
            } else {
                lastRegistrationError = "No device token yet. Use a real device (not Simulator), check network, then tap Register now again."
            }
            return
        }
        lastRegistrationError = "Registering with server…"
        do {
            try await APIService.shared.registerDevice(token: t)
            lastRegistrationSuccess = true
            lastRegistrationError = nil
            apnsRegistrationError = nil
        } catch {
            lastRegistrationSuccess = false
            lastRegistrationError = error.localizedDescription
        }
    }

    func reregisterIfPossible() {
        let token = UserDefaults.standard.string(forKey: "apnsDeviceToken")
        if let token, !token.isEmpty {
            Task { await registerWithServer(token: token) }
            return
        }
        // Permission granted but no token yet (e.g. delayed delivery); ask iOS again.
        if isAuthorized {
            UIApplication.shared.registerForRemoteNotifications()
            Task { await waitForTokenAndRegister() }
        }
    }

    func handleRegistrationError(_ error: Error) {
        apnsRegistrationError = error.localizedDescription
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
