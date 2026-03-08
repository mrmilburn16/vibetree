import SwiftUI
import UserNotifications
import FirebaseCore

@main
struct VibeTreeCompanionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        Self.configureFirebaseIfValid()
    }

    /// Call FirebaseApp.configure() only when GoogleService-Info.plist is in the bundle and has real values.
    /// Invalid or placeholder plist causes Firebase to crash; we skip configure and the app runs without Auth.
    private static func configureFirebaseIfValid() {
        guard let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
              let plist = NSDictionary(contentsOf: url) as? [String: Any],
              let projectId = plist["PROJECT_ID"] as? String, !projectId.isEmpty,
              !projectId.hasPrefix("REPLACE"),
              let apiKey = plist["API_KEY"] as? String, !apiKey.isEmpty,
              !apiKey.hasPrefix("REPLACE") else {
            #if DEBUG
            print("[Firebase] GoogleService-Info.plist missing, invalid, or still has placeholders (REPLACE_WITH_*). Skipping FirebaseApp.configure(). Download the real plist from Firebase Console for your project.")
            #endif
            return
        }
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(DeepLinkController.shared)
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Migrate stale localhost serverURL to the Mac's local IP. Empty = user must set Server URL in Settings.
        let stored = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        if stored.contains("localhost") {
            UserDefaults.standard.set("http://192.168.12.40:3001", forKey: "serverURL")
        }

        UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)

        Task { @MainActor in
            await NotificationService.shared.requestPermission()
            NotificationService.shared.reregisterIfPossible()
            BuildMonitorService.shared.startPolling()
        }

        return true
    }

    func application(
        _ application: UIApplication,
        performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task { @MainActor in
            await BuildMonitorService.shared.refreshOnce()
            completionHandler(.newData)
        }
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        Task { @MainActor in
            NotificationService.shared.reregisterIfPossible()
            await BuildMonitorService.shared.refreshOnce()
        }
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            NotificationService.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            NotificationService.shared.handleRegistrationError(error)
        }
    }

    // Wake up on pushes (especially background/silent) to refresh build state and start/end Live Activities.
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task { @MainActor in
            await BuildMonitorService.shared.refreshOnce()
            completionHandler(.newData)
        }
    }

    // Show notifications even when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .badge]
    }

    // When user taps the notification, open the project's conversation (deep link).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let projectId = userInfo["projectId"] as? String
        print("[DeepLink] Notification tapped, userInfo keys:", userInfo.keys.map { "\($0)" }, "projectId:", projectId ?? "nil")
        if let projectId, !projectId.isEmpty {
            Task { @MainActor in
                DeepLinkController.shared.setPending(projectId: projectId)
                print("[DeepLink] setPending(projectId: \(projectId))")
            }
        }
        completionHandler()
    }
}
