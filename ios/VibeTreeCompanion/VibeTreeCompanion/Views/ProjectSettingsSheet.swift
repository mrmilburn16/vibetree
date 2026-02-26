import SwiftUI

struct ProjectSettingsSheet: View {
    let project: Project
    var onProjectUpdate: ((String, String) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var displayName: String = ""
    @State private var bundleId: String = ""
    @State private var nameError: String?
    @State private var bundleError: String?
    @State private var teamId: String = ""
    @State private var teamIdOverride = false
    @State private var minIOSVersion: String = "17.0"
    @State private var minIOSOverride = false
    @State private var deviceFamily: String = "1"
    @State private var deviceFamilyOverride = false
    @State private var orientation: String = "all"
    @State private var orientationOverride = false
    @State private var exportLoading = false

    private static let universalKey = "vibetree-universal-defaults"
    private static let teamIdPrefix = "vibetree-xcode-team-id:"
    private static let projectSettingsPrefix = "vibetree-project-settings:"

    /// Web app order: 17.0, 17.2, 18.0, 18.1, 26.0 (iOS 26 Liquid Glass).
    private let iosVersionOptions = ["17.0", "17.2", "18.0", "18.1", "26.0"]
    /// Web: iPhone only, iPhone & iPad, iPad only (value 1, 1,2, 2).
    private let deviceFamilyOptions: [(value: String, label: String)] = [
        ("1", "iPhone only"),
        ("1,2", "iPhone & iPad"),
        ("2", "iPad only"),
    ]
    /// Web: All orientations, Portrait only, Landscape only.
    private let orientationOptions: [(value: String, label: String)] = [
        ("all", "All orientations"),
        ("portrait", "Portrait only"),
        ("landscape", "Landscape only"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space6) {
                    identitySection
                    signingSection
                    deploymentSection
                    exportSection
                }
                .padding(Forest.space4)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("Project Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .font(Forest.font(size: Forest.textBase, weight: .medium))
                    .foregroundColor(Forest.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveAndDismiss()
                    }
                    .font(Forest.font(size: Forest.textBase, weight: .semibold))
                    .foregroundColor(Forest.buttonPrimaryText)
                    .padding(.horizontal, Forest.space3)
                    .padding(.vertical, Forest.space2)
                    .background(Forest.accent)
                    .cornerRadius(Forest.radiusSm)
                }
            }
        }
        .onAppear { loadSettings() }
    }

    // MARK: - Identity

    private var identitySection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionHeader("IDENTITY")

            fieldRow(label: "Display Name") {
                TextField("My app", text: $displayName)
                    .textFieldStyle(.plain)
                    .forestInput()
            }
            if let nameError {
                Text(nameError)
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.error)
            }

            fieldRow(label: "Bundle ID") {
                TextField("com.yourcompany.appname", text: $bundleId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
            }
            if let bundleError {
                Text(bundleError)
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.error)
            }
        }
        .forestCard()
    }

    // MARK: - Signing

    private var signingSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionHeader("SIGNING")

            universalFieldRow(
                label: "Team ID",
                isOverridden: teamIdOverride,
                onReset: { teamIdOverride = false; teamId = loadUniversalDefaults()["teamId"] ?? "" }
            ) {
                TextField("ABCDE12345", text: $teamId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
                    .onChange(of: teamId) { _, newValue in
                        let filtered = String(newValue.uppercased().filter { $0.isLetter || $0.isNumber })
                        if filtered != newValue { teamId = filtered }
                        teamIdOverride = true
                    }
            }
        }
        .forestCard()
    }

    // MARK: - Deployment

    private var deploymentSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionHeader("DEPLOYMENT")

            universalFieldRow(
                label: "Minimum iOS",
                isOverridden: minIOSOverride,
                onReset: { minIOSOverride = false; minIOSVersion = loadUniversalDefaults()["deploymentTarget"] ?? "17.0" }
            ) {
                menuField(value: minIOSVersion) {
                    ForEach(iosVersionOptions, id: \.self) { v in
                        Button(v) { minIOSVersion = v; minIOSOverride = true }
                    }
                }
            }

            universalFieldRow(
                label: "Supported Devices",
                isOverridden: deviceFamilyOverride,
                onReset: {
                    deviceFamilyOverride = false
                    deviceFamily = loadUniversalDefaults()["deviceFamily"] ?? "1"
                }
            ) {
                menuField(value: deviceFamilyOptions.first(where: { $0.value == deviceFamily })?.label ?? "iPhone only") {
                    ForEach(deviceFamilyOptions, id: \.value) { opt in
                        Button(opt.label) { deviceFamily = opt.value; deviceFamilyOverride = true }
                    }
                }
            }

            universalFieldRow(
                label: "Orientation",
                isOverridden: orientationOverride,
                onReset: {
                    orientationOverride = false
                    orientation = loadUniversalDefaults()["orientation"] ?? "all"
                }
            ) {
                menuField(value: orientationOptions.first(where: { $0.value == orientation })?.label ?? "All orientations") {
                    ForEach(orientationOptions, id: \.value) { opt in
                        Button(opt.label) { orientation = opt.value; orientationOverride = true }
                    }
                }
            }
        }
        .forestCard()
    }

    // MARK: - Export

    private var exportSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionHeader("EXPORT")

            Button {
                exportXcodeZip()
            } label: {
                HStack(spacing: Forest.space2) {
                    Image(systemName: "arrow.down.doc.fill")
                        .font(Forest.font(size: 16))
                    Text(exportLoading ? "Preparing…" : "Download for Xcode (.zip)")
                        .font(Forest.font(size: Forest.textBase, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .foregroundColor(Forest.buttonPrimaryText)
                .padding(Forest.space4)
                .background(Forest.accent)
                .cornerRadius(Forest.radiusSm)
            }
            .disabled(exportLoading)
        }
        .forestCard()
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(Forest.font(size: Forest.textXs, weight: .semibold))
            .foregroundColor(Forest.textTertiary)
            .textCase(.uppercase)
            .tracking(0.8)
    }

    private func fieldRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            Text(label)
                .font(Forest.font(size: Forest.textSm, weight: .medium))
                .foregroundColor(Forest.textSecondary)
            content()
        }
    }

    private func universalFieldRow<Content: View>(
        label: String,
        isOverridden: Bool,
        onReset: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            HStack {
                Text(label)
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.textSecondary)
                Spacer()
                if isOverridden {
                    Button(action: onReset) {
                        HStack(spacing: 2) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(Forest.font(size: 10))
                            Text("Reset")
                                .font(Forest.font(size: 10, weight: .medium))
                        }
                        .foregroundColor(Forest.textTertiary)
                    }
                } else {
                    Text("Universal")
                        .font(Forest.font(size: 10, weight: .medium))
                        .foregroundColor(Forest.accentLight)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Forest.accent.opacity(0.25))
                        .cornerRadius(4)
                }
            }
            content()
        }
    }

    private func menuField<Content: View>(value: String, @ViewBuilder menuContent: () -> Content) -> some View {
        Menu {
            menuContent()
        } label: {
            HStack {
                Text(value)
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

    // MARK: - Validation & Save

    private func saveAndDismiss() {
        nameError = nil
        bundleError = nil

        let trimmedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedName.isEmpty {
            nameError = "Project name is required."
            return
        }

        let trimmedBundle = bundleId.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedBundle.isEmpty && !isValidBundleId(trimmedBundle) {
            bundleError = "Use a valid bundle ID (e.g. com.yourcompany.appname)."
            return
        }

        saveSettings()
        Task {
            do {
                _ = try await APIService.shared.updateProject(id: project.id, name: trimmedName, bundleId: trimmedBundle.isEmpty ? nil : trimmedBundle)
                await MainActor.run {
                    onProjectUpdate?(trimmedName, trimmedBundle.isEmpty ? project.effectiveBundleId : trimmedBundle)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    nameError = "Failed to save."
                }
            }
        }
    }

    private func isValidBundleId(_ value: String) -> Bool {
        let pattern = #"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$"#
        return value.range(of: pattern, options: .regularExpression) != nil
    }

    private func exportXcodeZip() {
        exportLoading = true
        let baseURL = UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.12.40:3001"
        guard let url = URL(string: "\(baseURL)/api/projects/\(project.id)/export-xcode") else {
            exportLoading = false
            return
        }
        UIApplication.shared.open(url) { _ in
            DispatchQueue.main.async { exportLoading = false }
        }
    }

    // MARK: - Persistence

    private func loadSettings() {
        displayName = project.name
        bundleId = project.bundleId ?? project.effectiveBundleId

        var defaults = loadUniversalDefaults()
        teamId = defaults["teamId"] ?? ""
        minIOSVersion = defaults["deploymentTarget"] ?? "17.0"
        deviceFamily = defaults["deviceFamily"] ?? "1"
        orientation = defaults["orientation"] ?? "all"

        let projectKey = Self.projectSettingsPrefix + project.id
        if let data = UserDefaults.standard.data(forKey: projectKey),
           let decoded = try? JSONDecoder().decode(ProjectSettingsOverrides.self, from: data) {
            if let v = decoded.teamId { teamId = v; teamIdOverride = true }
            if let v = decoded.deploymentTarget { minIOSVersion = v; minIOSOverride = true }
            if let v = decoded.deviceFamily { deviceFamily = v; deviceFamilyOverride = true }
            if let v = decoded.orientation { orientation = v; orientationOverride = true }
        }

        let teamIdStored = UserDefaults.standard.string(forKey: Self.teamIdPrefix + project.id)
        if let v = teamIdStored {
            teamId = v
            teamIdOverride = true
        }
    }

    private func saveSettings() {
        var defaults = loadUniversalDefaults()
        if !teamIdOverride { defaults["teamId"] = teamId }
        if !minIOSOverride { defaults["deploymentTarget"] = minIOSVersion }
        if !deviceFamilyOverride { defaults["deviceFamily"] = deviceFamily }
        if !orientationOverride { defaults["orientation"] = orientation }
        saveUniversalDefaults(defaults)

        if teamIdOverride {
            UserDefaults.standard.set(teamId, forKey: Self.teamIdPrefix + project.id)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.teamIdPrefix + project.id)
        }

        var overrides = ProjectSettingsOverrides()
        if teamIdOverride { overrides.teamId = teamId }
        if minIOSOverride { overrides.deploymentTarget = minIOSVersion }
        if deviceFamilyOverride { overrides.deviceFamily = deviceFamily }
        if orientationOverride { overrides.orientation = orientation }
        if let data = try? JSONEncoder().encode(overrides) {
            UserDefaults.standard.set(data, forKey: Self.projectSettingsPrefix + project.id)
        }
    }

    private func loadUniversalDefaults() -> [String: String] {
        guard let data = UserDefaults.standard.data(forKey: Self.universalKey),
              let dict = try? JSONDecoder().decode([String: String].self, from: data)
        else { return [:] }
        return dict
    }

    private func saveUniversalDefaults(_ dict: [String: String]) {
        if let data = try? JSONEncoder().encode(dict) {
            UserDefaults.standard.set(data, forKey: Self.universalKey)
        }
    }
}

private struct ProjectSettingsOverrides: Codable {
    var teamId: String?
    var deploymentTarget: String?
    var deviceFamily: String?
    var orientation: String?
}
