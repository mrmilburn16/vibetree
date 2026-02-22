import SwiftUI

struct ProjectSettingsSheet: View {
    let project: Project
    @Environment(\.dismiss) private var dismiss

    @State private var displayName: String = ""
    @State private var bundleId: String = ""
    @State private var teamId: String = ""
    @State private var teamIdOverride = false
    @State private var minIOSVersion: String = "17.0"
    @State private var minIOSOverride = false
    @State private var deviceFamily: DeviceFamily = .iphone
    @State private var deviceFamilyOverride = false
    @State private var orientation: Orientation = .portrait
    @State private var orientationOverride = false

    private static let universalKey = "vibetree-universal-defaults"

    enum DeviceFamily: String, CaseIterable {
        case iphone = "iPhone"
        case ipad = "iPad"
        case both = "iPhone & iPad"
    }

    enum Orientation: String, CaseIterable {
        case portrait = "Portrait"
        case landscape = "Landscape"
        case all = "All"
    }

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
                    Button("Cancel") { dismiss() }
                        .foregroundColor(Forest.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveSettings()
                        dismiss()
                    }
                    .foregroundColor(Forest.accent)
                    .fontWeight(.semibold)
                }
            }
        }
        .onAppear { loadSettings() }
    }

    // MARK: - Identity

    private var identitySection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Identity")

            fieldRow(label: "Display Name") {
                TextField("My App", text: $displayName)
                    .textFieldStyle(.plain)
                    .forestInput()
            }

            fieldRow(label: "Bundle ID") {
                TextField("com.example.myapp", text: $bundleId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
            }
        }
        .forestCard()
    }

    // MARK: - Signing

    private var signingSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Signing")

            universalField(
                label: "Team ID",
                value: $teamId,
                isOverridden: $teamIdOverride,
                placeholder: "ABCDE12345"
            ) {
                TextField("ABCDE12345", text: $teamId)
                    .textFieldStyle(.plain)
                    .forestInput()
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
            }
        }
        .forestCard()
    }

    // MARK: - Deployment

    private var deploymentSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Deployment")

            universalField(
                label: "Minimum iOS",
                value: $minIOSVersion,
                isOverridden: $minIOSOverride,
                placeholder: "17.0"
            ) {
                Menu {
                    ForEach(["17.0", "17.2", "17.4", "18.0", "18.2", "26.0"], id: \.self) { version in
                        Button(version) { minIOSVersion = version }
                    }
                } label: {
                    HStack {
                        Text(minIOSVersion)
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

            universalField(
                label: "Supported Devices",
                value: .constant(deviceFamily.rawValue),
                isOverridden: $deviceFamilyOverride,
                placeholder: "iPhone"
            ) {
                Menu {
                    ForEach(DeviceFamily.allCases, id: \.rawValue) { family in
                        Button(family.rawValue) { deviceFamily = family }
                    }
                } label: {
                    HStack {
                        Text(deviceFamily.rawValue)
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

            universalField(
                label: "Orientation",
                value: .constant(orientation.rawValue),
                isOverridden: $orientationOverride,
                placeholder: "Portrait"
            ) {
                Menu {
                    ForEach(Orientation.allCases, id: \.rawValue) { ori in
                        Button(ori.rawValue) { orientation = ori }
                    }
                } label: {
                    HStack {
                        Text(orientation.rawValue)
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

    // MARK: - Export

    private var exportSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            sectionLabel("Export")

            Button {
                if let url = URL(string:
                    "\(UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3001")/api/projects/\(project.id)/export-xcode"
                ) {
                    UIApplication.shared.open(url)
                }
            } label: {
                HStack {
                    Spacer()
                    Image(systemName: "arrow.down.doc.fill")
                        .font(.system(size: 14))
                    Text("Download for Xcode (.zip)")
                        .font(.system(size: Forest.textBase, weight: .semibold))
                    Spacer()
                }
                .foregroundColor(Forest.buttonPrimaryText)
                .padding(Forest.space3)
                .background(Forest.accent)
                .cornerRadius(Forest.radiusSm)
            }
        }
        .forestCard()
    }

    // MARK: - Helpers

    @ViewBuilder
    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.system(size: Forest.textXs, weight: .semibold))
            .foregroundColor(Forest.textTertiary)
            .textCase(.uppercase)
            .tracking(0.8)
    }

    @ViewBuilder
    private func fieldRow(label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            Text(label)
                .font(.system(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
            content()
        }
    }

    @ViewBuilder
    private func universalField<V, Content: View>(
        label: String,
        value: Binding<V>,
        isOverridden: Binding<Bool>,
        placeholder: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            HStack {
                Text(label)
                    .font(.system(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                Spacer()
                if !isOverridden.wrappedValue {
                    Text("Universal")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Forest.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Forest.accent.opacity(0.12))
                        .cornerRadius(4)
                } else {
                    Button {
                        isOverridden.wrappedValue = false
                    } label: {
                        HStack(spacing: 2) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.system(size: 10))
                            Text("Reset")
                                .font(.system(size: 10, weight: .medium))
                        }
                        .foregroundColor(Forest.textTertiary)
                    }
                }
            }
            content()
                .onChange(of: isOverridden.wrappedValue) { _, _ in }
        }
    }

    // MARK: - Persistence

    private func loadSettings() {
        displayName = project.name
        bundleId = "com.vibetree.\(project.name.lowercased().replacingOccurrences(of: " ", with: ""))"

        let defaults = loadUniversalDefaults()
        teamId = defaults["teamId"] ?? ""
        minIOSVersion = defaults["minIOSVersion"] ?? "17.0"
        deviceFamily = DeviceFamily(rawValue: defaults["deviceFamily"] ?? "iPhone") ?? .iphone
        orientation = Orientation(rawValue: defaults["orientation"] ?? "Portrait") ?? .portrait

        let projectKey = "vibetree-project-\(project.id)-settings"
        if let data = UserDefaults.standard.data(forKey: projectKey),
           let overrides = try? JSONDecoder().decode([String: String].self, from: data) {
            if let v = overrides["teamId"] { teamId = v; teamIdOverride = true }
            if let v = overrides["minIOSVersion"] { minIOSVersion = v; minIOSOverride = true }
            if let v = overrides["deviceFamily"], let f = DeviceFamily(rawValue: v) { deviceFamily = f; deviceFamilyOverride = true }
            if let v = overrides["orientation"], let o = Orientation(rawValue: v) { orientation = o; orientationOverride = true }
        }
    }

    private func saveSettings() {
        var universals = loadUniversalDefaults()
        if !teamIdOverride { universals["teamId"] = teamId }
        if !minIOSOverride { universals["minIOSVersion"] = minIOSVersion }
        if !deviceFamilyOverride { universals["deviceFamily"] = deviceFamily.rawValue }
        if !orientationOverride { universals["orientation"] = orientation.rawValue }
        saveUniversalDefaults(universals)

        var overrides: [String: String] = [:]
        if teamIdOverride { overrides["teamId"] = teamId }
        if minIOSOverride { overrides["minIOSVersion"] = minIOSVersion }
        if deviceFamilyOverride { overrides["deviceFamily"] = deviceFamily.rawValue }
        if orientationOverride { overrides["orientation"] = orientation.rawValue }

        let projectKey = "vibetree-project-\(project.id)-settings"
        if let data = try? JSONEncoder().encode(overrides) {
            UserDefaults.standard.set(data, forKey: projectKey)
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
