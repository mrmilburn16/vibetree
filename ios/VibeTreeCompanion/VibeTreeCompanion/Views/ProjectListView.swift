import SwiftUI

private let deleteConfirmText = "DELETE"

struct ProjectListView: View {
    @StateObject private var service = ProjectService.shared
    @StateObject private var credits = CreditsService.shared
    @State private var promptText = ""
    @State private var navigateToProject: Project?
    @State private var pendingPrompt: String?
    @State private var heroAppeared = false
    @State private var creditsMenuOpen = false
    @State private var deleteTargetProject: Project?
    @State private var deleteConfirmInput = ""
    @FocusState private var isPromptFocused: Bool

    private let suggestionChips = [
        "A fitness tracker with activity rings",
        "A recipe app with step-by-step cooking",
        "A habit tracker with streaks and stats",
        "A journaling app with mood tracking",
    ]

    private let randomPrompts = [
        "A weather app with animated backgrounds",
        "A meditation timer with calming sounds",
        "A budget tracker with spending charts",
        "A reading list app with progress tracking",
        "A countdown timer for upcoming events",
        "A plant care reminder app",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space8) {
                    heroSection
                    recentAppsSection
                }
                .padding(.bottom, Forest.space10)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(
                ZStack {
                    Forest.backgroundPrimary
                    RadialGradient(
                        colors: [
                            Forest.accent.opacity(0.06),
                            Color.clear
                        ],
                        center: .init(x: 0.5, y: 0.25),
                        startRadius: 0,
                        endRadius: UIScreen.main.bounds.height * 0.5
                    )
                    .ignoresSafeArea()
                }
            )
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 10) {
                        Text("Vibetree")
                            .font(Forest.font(size: Forest.textLg, weight: .semibold))
                            .foregroundColor(Forest.textPrimary)
                        Text("BETA")
                            .font(Forest.font(size: 10, weight: .medium))
                            .tracking(1)
                            .textCase(.uppercase)
                            .foregroundColor(Forest.textTertiary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .overlay(
                                RoundedRectangle(cornerRadius: Forest.radiusSm)
                                    .stroke(Forest.border, lineWidth: 1)
                            )
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    CreditBalanceView(credits: credits, isDropdownOpen: $creditsMenuOpen)
                }
            }
            .refreshable { await service.fetchProjects() }
            .task {
                // Always fetch when Projects tab appears so list stays in sync with web (same GET /api/projects).
                await service.fetchProjects()
                await credits.fetchBalance()
            }
            .navigationDestination(item: $navigateToProject) { project in
                EditorView(project: project, pendingPrompt: pendingPrompt)
            }
            .sheet(item: $deleteTargetProject) { project in
                deleteAppSheet(
                    project: project,
                    confirmInput: $deleteConfirmInput,
                    onCancel: {
                        deleteTargetProject = nil
                        deleteConfirmInput = ""
                    },
                    onConfirm: {
                        HapticService.heavy()
                        Task { await service.deleteProject(id: project.id) }
                        deleteTargetProject = nil
                        deleteConfirmInput = ""
                    }
                )
            }
            .overlay {
                if creditsMenuOpen {
                    ZStack(alignment: .topTrailing) {
                        Color.black.opacity(0.001)
                            .ignoresSafeArea()
                            .contentShape(Rectangle())
                            .onTapGesture { creditsMenuOpen = false }
                        CreditsDropdownContent(credits: credits, isOpen: $creditsMenuOpen)
                            .padding(.top, 56)
                            .padding(.trailing, 16)
                            .zIndex(1)
                    }
                }
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(spacing: Forest.space5) {
            Spacer().frame(height: Forest.space8)

            VStack(spacing: Forest.space2) {
                Text("What do you want to build?")
                    .font(Forest.font(size: Forest.text2Xl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Describe your app and we'll build it for you")
                    .font(Forest.font(size: Forest.textSm))
                    .foregroundColor(Forest.textTertiary)
            }
            .opacity(heroAppeared ? 1 : 0)
            .offset(y: heroAppeared ? 0 : 12)

            promptInput
                .opacity(heroAppeared ? 1 : 0)
                .offset(y: heroAppeared ? 0 : 8)

            chipRow
                .opacity(heroAppeared ? 1 : 0)
                .offset(y: heroAppeared ? 0 : 8)

            Spacer().frame(height: Forest.space2)
        }
        .padding(.horizontal, Forest.space4)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                heroAppeared = true
            }
        }
    }

    private var promptInput: some View {
        HStack(alignment: .center, spacing: Forest.space2) {
            TextField("A social app for sharing recipes with friends…", text: $promptText, axis: .vertical)
                .font(Forest.font(size: Forest.textBase))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($isPromptFocused)
                .submitLabel(canSubmit ? .send : .done)
                .onSubmit {
                    if canSubmit {
                        submitPrompt()
                    } else {
                        isPromptFocused = false
                    }
                }
                .frame(minHeight: 36)

            Button(action: submitPrompt) {
                ZStack {
                    Circle()
                        .fill(canSubmit ? Forest.accent : Forest.buttonSecondaryBg)
                        .frame(width: 36, height: 36)
                    Image(systemName: "arrow.up")
                        .font(Forest.font(size: 16, weight: .semibold))
                        .foregroundColor(canSubmit ? .white : Forest.textTertiary)
                }
            }
            .disabled(!canSubmit)
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space3)
        .background(Forest.inputBg)
        .cornerRadius(26)
        .overlay(
            RoundedRectangle(cornerRadius: 26)
                .stroke(Forest.inputBorder, lineWidth: 2)
        )
    }

    private var chipRow: some View {
        VStack(spacing: Forest.space2) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Forest.space2) {
                    ForEach(suggestionChips, id: \.self) { chip in
                        Button {
                            HapticService.selection()
                            promptText = chip
                            submitPrompt()
                        } label: {
                            Text(chip)
                                .font(Forest.font(size: Forest.textXs, weight: .medium))
                                .foregroundColor(Forest.textSecondary)
                                .padding(.horizontal, Forest.space3)
                                .padding(.vertical, 6)
                                .background(Forest.backgroundTertiary)
                                .cornerRadius(Forest.radiusXl)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Forest.radiusXl)
                                        .stroke(Forest.border, lineWidth: 1)
                                )
                        }
                    }

                    Button {
                        HapticService.selection()
                        promptText = randomPrompts.randomElement() ?? "Surprise me"
                        submitPrompt()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                                .font(Forest.font(size: 10))
                            Text("Surprise me")
                                .font(Forest.font(size: Forest.textXs, weight: .medium))
                        }
                        .foregroundColor(Forest.accent)
                        .padding(.horizontal, Forest.space3)
                        .padding(.vertical, 6)
                        .background(Forest.accent.opacity(0.1))
                        .cornerRadius(Forest.radiusXl)
                        .overlay(
                            RoundedRectangle(cornerRadius: Forest.radiusXl)
                                .stroke(Forest.accent.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal, Forest.space4)
            }
        }
    }

    private var canSubmit: Bool {
        !promptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Placeholder id prefix so we can replace with the real project when API returns.
    private static let pendingIdPrefix = "pending-"

    private func createNewBlankApp() {
        let now = Date().timeIntervalSince1970 * 1000
        let placeholder = Project(
            id: Self.pendingIdPrefix + UUID().uuidString,
            name: "Untitled app",
            bundleId: nil,
            projectType: .pro,
            createdAt: now,
            updatedAt: now,
            fileCount: nil
        )
        service.projects.insert(placeholder, at: 0)

        Task {
            if let project = await service.createProject(name: "Untitled app", type: .pro) {
                service.projects.removeAll { $0.id.hasPrefix(Self.pendingIdPrefix) }
                pendingPrompt = nil
                navigateToProject = project
            } else {
                service.projects.removeAll { $0.id == placeholder.id }
            }
        }
    }

    private func submitPrompt() {
        let trimmed = promptText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        promptText = ""
        isPromptFocused = false

        Task {
            if let project = await service.createProject(name: "Untitled app", type: .pro) {
                pendingPrompt = trimmed
                navigateToProject = project
            }
        }
    }

    // MARK: - Recent Apps Section

    private var recentAppsSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            if !service.projects.isEmpty {
                HStack {
                    Text("Recent apps")
                        .font(Forest.font(size: Forest.textSm, weight: .semibold))
                        .foregroundColor(Forest.textTertiary)
                        .textCase(.uppercase)
                        .tracking(0.6)
                    Spacer()
                    Button {
                        createNewBlankApp()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(Forest.font(size: 10))
                            Text("New blank app")
                                .font(Forest.font(size: Forest.textXs, weight: .medium))
                        }
                        .foregroundColor(Forest.accent)
                    }
                }
                .padding(.horizontal, Forest.space4)

                LazyVStack(spacing: 0) {
                    ForEach(Array(service.projects.enumerated()), id: \.element.id) { index, project in
                        Button {
                            pendingPrompt = nil
                            navigateToProject = project
                        } label: {
                            projectRow(project)
                                .opacity(heroAppeared ? 1 : 0)
                                .offset(y: heroAppeared ? 0 : 10)
                                .animation(
                                    .easeOut(duration: 0.35).delay(0.1 + Double(index) * 0.05),
                                    value: heroAppeared
                                )
                        }
                        .buttonStyle(.plain)
                        .contentShape(Rectangle())
                        .contextMenu {
                            Button(role: .destructive) {
                                HapticService.heavy()
                                deleteConfirmInput = ""
                                deleteTargetProject = project
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }

                        if project.id != service.projects.last?.id {
                            Divider()
                                .background(Forest.border)
                                .padding(.leading, Forest.space4 + 36)
                        }
                    }
                }
                .background(Forest.backgroundSecondary)
                .cornerRadius(Forest.radiusMd)
                .overlay(
                    RoundedRectangle(cornerRadius: Forest.radiusMd)
                        .stroke(Forest.border, lineWidth: 1)
                )
                .padding(.horizontal, Forest.space4)
            }
        }
    }

    private func projectRow(_ project: Project) -> some View {
        HStack(spacing: Forest.space3) {
            ZStack {
                RoundedRectangle(cornerRadius: Forest.radiusSm)
                    .fill(Forest.accent.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: (project.projectType ?? .pro).icon)
                    .font(Forest.font(size: 14))
                    .foregroundColor(Forest.accent)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(Forest.font(size: Forest.textBase, weight: .medium))
                    .foregroundColor(Forest.textPrimary)
                    .lineLimit(1)

                Text("Updated \(project.formattedDate)")
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(Forest.font(size: 12, weight: .medium))
                .foregroundColor(Forest.textTertiary)
        }
        .contentShape(Rectangle())
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space3)
    }

    // MARK: - Delete app sheet (matches web: type DELETE to confirm)

    private func deleteAppSheet(
        project: Project,
        confirmInput: Binding<String>,
        onCancel: @escaping () -> Void,
        onConfirm: @escaping () -> Void
    ) -> some View {
        let canDelete = confirmInput.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines) == deleteConfirmText
        return NavigationStack {
            VStack(alignment: .leading, spacing: Forest.space4) {
                Text("This will permanently delete this app and its data. This cannot be undone.")
                    .font(Forest.font(size: Forest.textSm))
                    .foregroundColor(Forest.textSecondary)

                (Text("Type ") + Text(deleteConfirmText).fontWeight(.semibold) + Text(" to confirm:"))
                    .font(Forest.font(size: Forest.textSm))
                    .foregroundColor(Forest.textTertiary)
                TextField(deleteConfirmText, text: confirmInput)
                    .font(Forest.fontMono(size: Forest.textSm))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(Forest.space3)
                    .background(Forest.backgroundPrimary)
                    .foregroundColor(Forest.textPrimary)
                    .cornerRadius(Forest.radiusMd)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusMd)
                            .stroke(Forest.border, lineWidth: 1)
                    )

                Spacer(minLength: 0)
            }
            .padding(Forest.space5)
            .background(Forest.backgroundSecondary)
            .navigationTitle("Delete app")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Delete") {
                        onConfirm()
                    }
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(Forest.destructiveText)
                    .disabled(!canDelete)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
