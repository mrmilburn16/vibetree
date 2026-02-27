import ActivityKit
import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("serverURL") private var serverURL = "http://192.168.12.40:3001"
    @AppStorage("apiToken") private var apiToken = ""
    @StateObject private var notifications = NotificationService.shared
    @StateObject private var auth = AuthService.shared
    @StateObject private var credits = CreditsService.shared
    @AppStorage("vibetree-universal-teamId") private var universalTeamId = ""
    @AppStorage("vibetree-universal-minIOS") private var universalMinIOS = "17.0"

    @State private var testStatus: TestStatus = .idle
    @State private var liveActivityTestMessage: String?
    @State private var testActivityId: String?
    @State private var liveActivityDebugInfo: String?

    enum TestStatus {
        case idle, testing, success, failed(String)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space6) {
                    accountSection
                    creditsSection
                    universalDefaultsSection
                    serverSection
                    notificationSection
                    liveActivitiesSection
                    connectionTestSection
                    aboutSection
                }
                .padding(Forest.space4)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("Settings")
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await credits.fetchBalance()
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Account")

            if auth.isAuthenticated {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(auth.userEmail ?? "Signed in")
                            .font(Forest.font(size: Forest.textBase, weight: .medium))
                            .foregroundColor(Forest.textPrimary)
                        Text("Active session")
                            .font(Forest.font(size: Forest.textXs))
                            .foregroundColor(Forest.success)
                    }
                    Spacer()
                    Button("Sign Out") {
                        HapticService.heavy()
                        auth.signOut()
                    }
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.destructiveText)
                }
            } else {
                HStack {
                    Text("Not signed in")
                        .font(Forest.font(size: Forest.textBase))
                        .foregroundColor(Forest.textSecondary)
                    Spacer()
                    NavigationLink("Sign In") {
                        SignInView()
                    }
                    .font(Forest.font(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.accent)
                }
            }
        }
        .forestCard()
    }

    // MARK: - Credits

    private var creditsSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Credits")

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Balance")
                        .font(Forest.font(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textTertiary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(credits.balance)")
                            .font(Forest.font(size: Forest.textXl, weight: .bold))
                            .foregroundColor(credits.isLow ? Forest.warning : Forest.accent)
                        Text("credits")
                            .font(Forest.font(size: Forest.textSm))
                            .foregroundColor(Forest.textTertiary)
                    }
                }
                Spacer()
                NavigationLink {
                    CreditsView()
                } label: {
                    Text("Buy More")
                        .font(Forest.font(size: Forest.textSm, weight: .semibold))
                        .foregroundColor(Forest.backgroundPrimary)
                        .padding(.horizontal, Forest.space4)
                        .padding(.vertical, Forest.space2)
                        .background(Forest.accent)
                        .cornerRadius(Forest.radiusSm)
                }
            }
        }
        .forestCard()
    }

    // MARK: - Universal Defaults

    private var universalDefaultsSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Universal Defaults")
            Text("These values apply to all new projects unless overridden.")
                .font(Forest.font(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("Team ID")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                TextField("ABCDE12345", text: $universalTeamId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
            }

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("Minimum iOS Version")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                Menu {
                    ForEach(["17.0", "17.2", "17.4", "18.0", "18.2", "26.0"], id: \.self) { version in
                        Button(version) { universalMinIOS = version }
                    }
                } label: {
                    HStack {
                        Text(universalMinIOS)
                            .font(Forest.font(size: Forest.textBase))
                            .foregroundColor(Forest.inputText)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(Forest.font(size: 12))
                            .foregroundColor(Forest.textTertiary)
                    }
                    .padding(Forest.space3)
                    .background(Forest.inputBg)
                    .cornerRadius(Forest.radiusSm)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusSm)
                            .stroke(Forest.inputBorder, lineWidth: 1)
                    )
                }
            }
        }
        .forestCard()
    }

    // MARK: - Server

    private var serverSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Server Configuration")

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("Server URL")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                TextField("https://your-server.com", text: $serverURL)
                    .textFieldStyle(.plain)
                    .font(Forest.font(size: Forest.textBase))
                    .foregroundColor(Forest.textPrimary)
                    .padding(Forest.space3)
                    .background(Forest.backgroundPrimary)
                    .cornerRadius(Forest.radiusSm)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusSm)
                            .stroke(Forest.border, lineWidth: 1)
                    )
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
            }

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("API Token")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                SecureField("MAC_RUNNER_TOKEN value", text: $apiToken)
                    .textFieldStyle(.plain)
                    .font(Forest.font(size: Forest.textBase))
                    .foregroundColor(Forest.textPrimary)
                    .padding(Forest.space3)
                    .background(Forest.backgroundPrimary)
                    .cornerRadius(Forest.radiusSm)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusSm)
                            .stroke(Forest.border, lineWidth: 1)
                    )
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
        }
        .forestCard()
    }

    // MARK: - Notifications

    private var notificationSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Notifications")

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Push Notifications")
                        .font(Forest.font(size: Forest.textBase, weight: .medium))
                        .foregroundColor(Forest.textPrimary)
                    Text(notifications.isAuthorized ? "Enabled" : "Tap to enable")
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(notifications.isAuthorized ? Forest.success : Forest.textTertiary)
                }
                Spacer()
                if notifications.isAuthorized {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Forest.success)
                        .font(Forest.font(size: 20))
                } else {
                    Button("Enable") {
                        Task { await notifications.requestPermission() }
                    }
                    .font(Forest.font(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.backgroundPrimary)
                    .padding(.horizontal, Forest.space4)
                    .padding(.vertical, Forest.space2)
                    .background(Forest.accent)
                    .cornerRadius(Forest.radiusSm)
                }
            }
        }
        .forestCard()
    }

    // MARK: - Live Activities

    private var liveActivitiesSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Live Activities")

            Text("Simulate a build so you can see the Live Activity on the lock screen or Dynamic Island without running a real build.")
                .font(Forest.font(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lock Screen & Dynamic Island")
                        .font(Forest.font(size: Forest.textBase, weight: .medium))
                        .foregroundColor(Forest.textPrimary)
                    Text(ActivityAuthorizationInfo().areActivitiesEnabled ? "Enabled" : "Disabled in iOS Settings")
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(ActivityAuthorizationInfo().areActivitiesEnabled ? Forest.success : Forest.textTertiary)
                }
                Spacer()
                Button("Start Test") {
                    startTestLiveActivity()
                }
                .font(Forest.font(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.backgroundPrimary)
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space2)
                .background(Forest.accent)
                .cornerRadius(Forest.radiusSm)
            }

            HStack {
                Button("End Test") {
                    Task { await endTestLiveActivity() }
                }
                .font(Forest.font(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textSecondary)
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space2)
                .background(Forest.backgroundSecondary)
                .cornerRadius(Forest.radiusSm)
                .disabled(testActivityId == nil)

                Button("Refresh Status") {
                    refreshLiveActivityDebugInfo()
                }
                .font(Forest.font(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textSecondary)
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space2)
                .background(Forest.backgroundSecondary)
                .cornerRadius(Forest.radiusSm)

                Spacer()
            }

            if let msg = liveActivityTestMessage {
                Text(msg)
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let info = liveActivityDebugInfo {
                Text(info)
                    .font(Forest.fontMono(size: 11))
                    .foregroundColor(Forest.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .forestCard()
    }

    // MARK: - Connection Test

    private var connectionTestSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Connection")

            Button(action: testConnection) {
                HStack {
                    Spacer()
                    switch testStatus {
                    case .idle:
                        Label("Test Connection", systemImage: "antenna.radiowaves.left.and.right")
                    case .testing:
                        ProgressView()
                            .tint(Forest.backgroundPrimary)
                        Text("Testing…")
                    case .success:
                        Label("Connected", systemImage: "checkmark.circle.fill")
                    case .failed(let msg):
                        Label(msg, systemImage: "xmark.circle.fill")
                    }
                    Spacer()
                }
                .font(Forest.font(size: Forest.textBase, weight: .semibold))
                .foregroundColor(testForeground)
                .padding(Forest.space3)
                .background(testBackground)
                .cornerRadius(Forest.radiusSm)
            }
            .disabled(isTestDisabled)
        }
        .forestCard()
    }

    private var testForeground: Color {
        switch testStatus {
        case .success: return Forest.backgroundPrimary
        case .failed: return .white
        default: return Forest.backgroundPrimary
        }
    }

    private var testBackground: Color {
        switch testStatus {
        case .success: return Forest.success
        case .failed: return Forest.error
        default: return Forest.accent
        }
    }

    private var isTestDisabled: Bool {
        if case .testing = testStatus { return true }
        return false
    }

    private func testConnection() {
        testStatus = .testing
        Task {
            do {
                _ = try await APIService.shared.fetchActiveBuilds()
                testStatus = .success
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                testStatus = .idle
            } catch {
                testStatus = .failed(error.localizedDescription)
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                testStatus = .idle
            }
        }
    }

    private func startTestLiveActivity() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            liveActivityTestMessage = "Live Activities are disabled for this app in iOS Settings."
            refreshLiveActivityDebugInfo()
            return
        }

        let jobId = "test_" + UUID().uuidString.lowercased()
        let attributes = BuildActivityAttributes(jobId: jobId, projectName: "Test Build")
        let state = BuildActivityAttributes.ContentState(
            status: "running",
            progress: 0.15,
            elapsedSeconds: 0,
            stepLabel: "Starting…",
            estimatedSecondsLeft: 240,
            attempt: 1,
            maxAttempts: 1
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60 * 10))

        do {
            let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            testActivityId = activity.id
            liveActivityTestMessage = "Test Live Activity started. Lock your phone now. If you still don’t see it, check iOS Settings → Face ID & Passcode → Live Activities, and Settings → VibeTree → Live Activities."
            refreshLiveActivityDebugInfo()

            // Keep it visibly updating for a bit.
            Task { @MainActor in
                for i in 1...20 {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    let progress = min(0.95, 0.15 + (Double(i) * 0.03))
                    let next = BuildActivityAttributes.ContentState(
                        status: "running",
                        progress: progress,
                        elapsedSeconds: i * 3,
                        stepLabel: "Running…",
                        estimatedSecondsLeft: max(0, 240 - (i * 3)),
                        attempt: 1,
                        maxAttempts: 1
                    )
                    await activity.update(ActivityContent(state: next, staleDate: Date().addingTimeInterval(60 * 10)))
                }
            }
        } catch {
            liveActivityTestMessage = "Could not start Live Activity: \(error.localizedDescription)"
            testActivityId = nil
            refreshLiveActivityDebugInfo()
        }
    }

    private func refreshLiveActivityDebugInfo() {
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        let activities = Activity<BuildActivityAttributes>.activities
        let ids = activities.map(\.id).joined(separator: ", ")
        let testId = testActivityId ?? "nil"
        liveActivityDebugInfo =
            "areActivitiesEnabled=\(enabled)\n" +
            "activeActivities.count=\(activities.count)\n" +
            "testActivityId=\(testId)\n" +
            "activeActivityIds=[\(ids)]"
    }

    private func endTestLiveActivity() async {
        let activities = Activity<BuildActivityAttributes>.activities
        let toEnd = activities.filter { activity in
            guard let testActivityId else { return false }
            return activity.id == testActivityId
        }

        for activity in toEnd {
            let endState = BuildActivityAttributes.ContentState(
                status: "succeeded",
                progress: 1.0,
                elapsedSeconds: 0,
                stepLabel: "Done",
                estimatedSecondsLeft: nil,
                attempt: 1,
                maxAttempts: 1
            )
            let endContent = ActivityContent(state: endState, staleDate: nil)
            await activity.end(endContent, dismissalPolicy: .immediate)
        }

        testActivityId = nil
        liveActivityTestMessage = "Ended test Live Activity."
        refreshLiveActivityDebugInfo()
    }

    // MARK: - About

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            sectionLabel("About")

            HStack {
                Text("VibeTree Companion")
                    .font(Forest.font(size: Forest.textSm))
                    .foregroundColor(Forest.textSecondary)
                Spacer()
                Text("v1.0")
                    .font(Forest.fontMono(size: Forest.textSm))
                    .foregroundColor(Forest.textTertiary)
            }

            if let token = notifications.deviceToken {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Device Token")
                        .font(Forest.font(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textTertiary)
                    Text(token.prefix(20) + "…")
                        .font(Forest.fontMono(size: 11))
                        .foregroundColor(Forest.textTertiary)
                }
            }
        }
        .forestCard()
    }

    @ViewBuilder
    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(Forest.font(size: Forest.textXs, weight: .semibold))
            .foregroundColor(Forest.textTertiary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}
