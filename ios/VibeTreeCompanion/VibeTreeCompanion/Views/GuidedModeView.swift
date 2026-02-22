import SwiftUI

struct GuidedModeView: View {
    let onComplete: (String, ProjectType) -> Void
    let onSkip: () -> Void

    @State private var currentStep = 0
    @State private var appDescription = ""
    @State private var selectedFeatures: Set<String> = []
    @State private var selectedProjectType: ProjectType = .pro

    private let totalSteps = 3

    private let featureOptions = [
        ("list", "Lists & Data"),
        ("camera", "Camera / Photos"),
        ("map", "Maps / Location"),
        ("bell", "Notifications"),
        ("chart.bar", "Charts / Analytics"),
        ("person.2", "Social / Profiles"),
        ("creditcard", "Payments"),
        ("lock.shield", "Authentication")
    ]

    var body: some View {
        VStack(spacing: 0) {
            progressDots
                .padding(.top, Forest.space4)

            TabView(selection: $currentStep) {
                describeStep.tag(0)
                featuresStep.tag(1)
                typeStep.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut(duration: 0.25), value: currentStep)

            bottomBar
        }
        .background(Forest.backgroundPrimary)
    }

    // MARK: - Progress Dots

    private var progressDots: some View {
        HStack(spacing: Forest.space2) {
            ForEach(0..<totalSteps, id: \.self) { step in
                Circle()
                    .fill(step <= currentStep ? Forest.accent : Forest.backgroundTertiary)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut, value: currentStep)
            }
        }
    }

    // MARK: - Step 1: Describe

    private var describeStep: some View {
        VStack(spacing: Forest.space6) {
            Spacer()

            VStack(spacing: Forest.space3) {
                Image(systemName: "text.bubble.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Forest.accent)
                Text("Describe Your App")
                    .font(.system(size: Forest.textXl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                Text("What kind of app do you want to build? Be as specific or general as you like.")
                    .font(.system(size: Forest.textSm))
                    .foregroundColor(Forest.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Forest.space4)
            }

            TextField("A habit tracker with streak cards and daily reminders…", text: $appDescription, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: Forest.textBase))
                .foregroundColor(Forest.inputText)
                .lineLimit(3...6)
                .padding(Forest.space4)
                .background(Forest.inputBg)
                .cornerRadius(Forest.radiusMd)
                .overlay(
                    RoundedRectangle(cornerRadius: Forest.radiusMd)
                        .stroke(Forest.inputBorder, lineWidth: 1)
                )
                .padding(.horizontal, Forest.space4)

            Spacer()
        }
    }

    // MARK: - Step 2: Features

    private var featuresStep: some View {
        VStack(spacing: Forest.space6) {
            Spacer()

            VStack(spacing: Forest.space3) {
                Image(systemName: "square.grid.2x2.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Forest.accent)
                Text("Select Features")
                    .font(.system(size: Forest.textXl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                Text("Pick any features you'd like included. You can always add more later.")
                    .font(.system(size: Forest.textSm))
                    .foregroundColor(Forest.textTertiary)
                    .multilineTextAlignment(.center)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Forest.space3) {
                ForEach(featureOptions, id: \.0) { icon, label in
                    featureChip(icon: icon, label: label)
                }
            }
            .padding(.horizontal, Forest.space4)

            Spacer()
        }
    }

    private func featureChip(icon: String, label: String) -> some View {
        let isSelected = selectedFeatures.contains(label)
        return Button {
            if isSelected { selectedFeatures.remove(label) }
            else { selectedFeatures.insert(label) }
        } label: {
            HStack(spacing: Forest.space2) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(label)
                    .font(.system(size: Forest.textSm, weight: .medium))
                    .lineLimit(1)
            }
            .foregroundColor(isSelected ? Forest.accent : Forest.textSecondary)
            .padding(.horizontal, Forest.space3)
            .padding(.vertical, Forest.space2)
            .frame(maxWidth: .infinity)
            .background(isSelected ? Forest.accent.opacity(0.12) : Forest.backgroundSecondary)
            .cornerRadius(Forest.radiusSm)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusSm)
                    .stroke(isSelected ? Forest.accent.opacity(0.4) : Forest.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Step 3: Type

    private var typeStep: some View {
        VStack(spacing: Forest.space6) {
            Spacer()

            VStack(spacing: Forest.space3) {
                Image(systemName: "hammer.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Forest.accent)
                Text("Choose Build Type")
                    .font(.system(size: Forest.textXl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
            }

            VStack(spacing: Forest.space3) {
                typeCard(
                    type: .pro,
                    title: "Pro (Swift)",
                    description: "Native SwiftUI app. Best performance, full iOS features, requires Xcode.",
                    icon: "swift"
                )
                typeCard(
                    type: .standard,
                    title: "Standard (Expo)",
                    description: "React Native with Expo Go. Quick preview, cross-platform potential.",
                    icon: "apps.iphone"
                )
            }
            .padding(.horizontal, Forest.space4)

            Spacer()
        }
    }

    private func typeCard(type: ProjectType, title: String, description: String, icon: String) -> some View {
        let isSelected = selectedProjectType == type
        return Button { selectedProjectType = type } label: {
            HStack(spacing: Forest.space3) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(isSelected ? Forest.accent : Forest.textTertiary)
                    .frame(width: 40)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: Forest.textBase, weight: .semibold))
                        .foregroundColor(Forest.textPrimary)
                    Text(description)
                        .font(.system(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Forest.accent)
                        .font(.system(size: 22))
                }
            }
            .padding(Forest.space4)
            .background(isSelected ? Forest.accent.opacity(0.08) : Forest.backgroundSecondary)
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(isSelected ? Forest.accent.opacity(0.5) : Forest.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack {
            if currentStep > 0 {
                Button("Back") {
                    currentStep -= 1
                }
                .foregroundColor(Forest.textSecondary)
            }

            Spacer()

            Button("Skip") {
                onSkip()
            }
            .foregroundColor(Forest.textTertiary)

            if currentStep < totalSteps - 1 {
                Button("Next") {
                    currentStep += 1
                }
                .buttonStyle(ForestPrimaryButtonStyle())
            } else {
                Button("Build It") {
                    let prompt = buildPrompt()
                    onComplete(prompt, selectedProjectType)
                }
                .buttonStyle(ForestPrimaryButtonStyle(isDisabled: appDescription.trimmingCharacters(in: .whitespaces).isEmpty))
                .disabled(appDescription.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(Forest.space4)
        .background(Forest.backgroundSecondary)
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(Forest.border),
            alignment: .top
        )
    }

    private func buildPrompt() -> String {
        var parts = [appDescription.trimmingCharacters(in: .whitespacesAndNewlines)]
        if !selectedFeatures.isEmpty {
            parts.append("Features: \(selectedFeatures.sorted().joined(separator: ", ")).")
        }
        return parts.joined(separator: " ")
    }
}
