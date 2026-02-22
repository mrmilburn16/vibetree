import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("serverURL") private var serverURL = "http://localhost:3001"
    @AppStorage("apiToken") private var apiToken = ""
    @StateObject private var notifications = NotificationService.shared

    @State private var testStatus: TestStatus = .idle

    enum TestStatus {
        case idle, testing, success, failed(String)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space6) {
                    serverSection
                    notificationSection
                    connectionTestSection
                    aboutSection
                }
                .padding(Forest.space4)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(Forest.accent)
                        .fontWeight(.semibold)
                }
            }
        }
        .preferredColorScheme(.dark)
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
                Text("VibTree Companion")
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
