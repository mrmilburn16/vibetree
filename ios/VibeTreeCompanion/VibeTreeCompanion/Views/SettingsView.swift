import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("serverURL") private var serverURL = "http://localhost:3001"
    @AppStorage("apiToken") private var apiToken = ""
    @StateObject private var notifications = NotificationService.shared
    @StateObject private var auth = AuthService.shared
    @StateObject private var credits = CreditsService.shared
    @AppStorage("vibetree-universal-teamId") private var universalTeamId = ""
    @AppStorage("vibetree-universal-minIOS") private var universalMinIOS = "17.0"

    @State private var testStatus: TestStatus = .idle

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
                            .font(.system(size: Forest.textBase, weight: .medium))
                            .foregroundColor(Forest.textPrimary)
                        Text("Active session")
                            .font(.system(size: Forest.textXs))
                            .foregroundColor(Forest.success)
                    }
                    Spacer()
                    Button("Sign Out") {
                        auth.signOut()
                    }
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.destructiveText)
                }
            } else {
                HStack {
                    Text("Not signed in")
                        .font(.system(size: Forest.textBase))
                        .foregroundColor(Forest.textSecondary)
                    Spacer()
                    NavigationLink("Sign In") {
                        SignInView()
                    }
                    .font(.system(size: Forest.textSm, weight: .semibold))
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
                        .font(.system(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textTertiary)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(credits.balance)")
                            .font(.system(size: Forest.textXl, weight: .bold, design: .rounded))
                            .foregroundColor(credits.isLow ? Forest.warning : Forest.accent)
                        Text("credits")
                            .font(.system(size: Forest.textSm))
                            .foregroundColor(Forest.textTertiary)
                    }
                }
                Spacer()
                NavigationLink {
                    CreditsView()
                } label: {
                    Text("Buy More")
                        .font(.system(size: Forest.textSm, weight: .semibold))
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
                .font(.system(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("Team ID")
                    .font(.system(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                TextField("ABCDE12345", text: $universalTeamId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
            }

            VStack(alignment: .leading, spacing: Forest.space1) {
                Text("Minimum iOS Version")
                    .font(.system(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                Menu {
                    ForEach(["17.0", "17.2", "17.4", "18.0", "18.2", "26.0"], id: \.self) { version in
                        Button(version) { universalMinIOS = version }
                    }
                } label: {
                    HStack {
                        Text(universalMinIOS)
                            .font(.system(size: Forest.textBase))
                            .foregroundColor(Forest.inputText)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 12))
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
                    .font(.system(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                TextField("https://your-server.com", text: $serverURL)
                    .textFieldStyle(.plain)
                    .font(.system(size: Forest.textBase))
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
                    .font(.system(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                SecureField("MAC_RUNNER_TOKEN value", text: $apiToken)
                    .textFieldStyle(.plain)
                    .font(.system(size: Forest.textBase))
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
                        .font(.system(size: Forest.textBase, weight: .medium))
                        .foregroundColor(Forest.textPrimary)
                    Text(notifications.isAuthorized ? "Enabled" : "Tap to enable")
                        .font(.system(size: Forest.textXs))
                        .foregroundColor(notifications.isAuthorized ? Forest.success : Forest.textTertiary)
                }
                Spacer()
                if notifications.isAuthorized {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Forest.success)
                        .font(.system(size: 20))
                } else {
                    Button("Enable") {
                        Task { await notifications.requestPermission() }
                    }
                    .font(.system(size: Forest.textSm, weight: .semibold))
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
                .font(.system(size: Forest.textBase, weight: .semibold))
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

    // MARK: - About

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            sectionLabel("About")

            HStack {
                Text("VibeTree Companion")
                    .font(.system(size: Forest.textSm))
                    .foregroundColor(Forest.textSecondary)
                Spacer()
                Text("v1.0")
                    .font(.system(size: Forest.textSm, design: .monospaced))
                    .foregroundColor(Forest.textTertiary)
            }

            if let token = notifications.deviceToken {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Device Token")
                        .font(.system(size: Forest.textXs, weight: .medium))
                        .foregroundColor(Forest.textTertiary)
                    Text(token.prefix(20) + "…")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(Forest.textTertiary)
                }
            }
        }
        .forestCard()
    }

    @ViewBuilder
    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.system(size: Forest.textXs, weight: .semibold))
            .foregroundColor(Forest.textTertiary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}
