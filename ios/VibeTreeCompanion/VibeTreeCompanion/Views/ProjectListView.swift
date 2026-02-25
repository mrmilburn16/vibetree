import SwiftUI

struct ProjectListView: View {
    @StateObject private var service = ProjectService.shared
    @StateObject private var credits = CreditsService.shared
    @State private var promptText = ""
    @State private var navigateToProject: Project?
    @State private var pendingPrompt: String?
    @State private var heroAppeared = false
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
                    Text("VibeTree")
                        .font(.system(size: Forest.textLg, weight: .bold))
                        .foregroundColor(Forest.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: CreditsView()) {
                        CreditBalanceView(credits: credits)
                    }
                }
            }
            .refreshable { await service.fetchProjects() }
            .task {
                if service.projects.isEmpty { await service.fetchProjects() }
                await credits.fetchBalance()
            }
            .navigationDestination(item: $navigateToProject) { project in
                EditorView(project: project, pendingPrompt: pendingPrompt)
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(spacing: Forest.space5) {
            Spacer().frame(height: Forest.space8)

            VStack(spacing: Forest.space2) {
                Text("What do you want to build?")
                    .font(.system(size: Forest.text2Xl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Describe your app and we'll build it for you")
                    .font(.system(size: Forest.textSm))
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
        HStack(alignment: .bottom, spacing: Forest.space2) {
            TextField("A social app for sharing recipes with friends…", text: $promptText, axis: .vertical)
                .font(.system(size: Forest.textBase))
                .foregroundColor(Forest.inputText)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .focused($isPromptFocused)

            Button(action: submitPrompt) {
                ZStack {
                    Circle()
                        .fill(canSubmit ? Forest.accent : Forest.buttonSecondaryBg)
                        .frame(width: 36, height: 36)
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .semibold))
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
        .onAppear { isPromptFocused = true }
    }

    private var chipRow: some View {
        VStack(spacing: Forest.space2) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Forest.space2) {
                    ForEach(suggestionChips, id: \.self) { chip in
                        Button {
                            promptText = chip
                            submitPrompt()
                        } label: {
                            Text(chip)
                                .font(.system(size: Forest.textXs, weight: .medium))
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
                        promptText = randomPrompts.randomElement() ?? "Surprise me"
                        submitPrompt()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 10))
                            Text("Surprise me")
                                .font(.system(size: Forest.textXs, weight: .medium))
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
                        .font(.system(size: Forest.textSm, weight: .semibold))
                        .foregroundColor(Forest.textTertiary)
                        .textCase(.uppercase)
                        .tracking(0.6)
                    Spacer()
                    Button {
                        Task {
                            if let project = await service.createProject(name: "Untitled app", type: .pro) {
                                navigateToProject = project
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 10))
                            Text("New blank app")
                                .font(.system(size: Forest.textXs, weight: .medium))
                        }
                        .foregroundColor(Forest.accent)
                    }
                }
                .padding(.horizontal, Forest.space4)

                LazyVStack(spacing: 0) {
                    ForEach(Array(service.projects.enumerated()), id: \.element.id) { index, project in
                        NavigationLink(destination: EditorView(project: project)) {
                            projectRow(project)
                                .opacity(heroAppeared ? 1 : 0)
                                .offset(y: heroAppeared ? 0 : 10)
                                .animation(
                                    .easeOut(duration: 0.35).delay(0.1 + Double(index) * 0.05),
                                    value: heroAppeared
                                )
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                Task { await service.deleteProject(id: project.id) }
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
                Image(systemName: project.projectType.icon)
                    .font(.system(size: 14))
                    .foregroundColor(Forest.accent)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(.system(size: Forest.textBase, weight: .medium))
                    .foregroundColor(Forest.textPrimary)
                    .lineLimit(1)

                Text("Updated \(project.formattedDate)")
                    .font(.system(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Forest.textTertiary)
        }
        .padding(.horizontal, Forest.space4)
        .padding(.vertical, Forest.space3)
    }
}
