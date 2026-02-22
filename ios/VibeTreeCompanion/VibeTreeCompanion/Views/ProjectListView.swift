import SwiftUI

struct ProjectListView: View {
    @StateObject private var service = ProjectService.shared
    @State private var showNewProject = false
    @State private var newProjectName = ""
    @State private var newProjectType: ProjectType = .pro

    private let columns = [
        GridItem(.flexible(), spacing: Forest.space4),
        GridItem(.flexible(), spacing: Forest.space4)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: Forest.space4) {
                    newAppCard

                    ForEach(service.projects) { project in
                        NavigationLink(destination: EditorView(project: project)) {
                            ProjectCard(project: project)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                Task { await service.deleteProject(id: project.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(Forest.space4)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("Projects")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable {
                await service.fetchProjects()
            }
            .task {
                if service.projects.isEmpty {
                    await service.fetchProjects()
                }
            }
            .alert("New App", isPresented: $showNewProject) {
                TextField("App name", text: $newProjectName)
                Button("Create") {
                    guard !newProjectName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                    Task {
                        _ = await service.createProject(name: newProjectName, type: newProjectType)
                        newProjectName = ""
                    }
                }
                Button("Cancel", role: .cancel) {
                    newProjectName = ""
                }
            } message: {
                Text("Give your app a name to get started.")
            }
        }
    }

    private var newAppCard: some View {
        Button { showNewProject = true } label: {
            VStack(spacing: Forest.space3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Forest.radiusMd)
                        .strokeBorder(Forest.accent.opacity(0.4), style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                    VStack(spacing: Forest.space2) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(Forest.accent)
                        Text("New App")
                            .font(.system(size: Forest.textSm, weight: .semibold))
                            .foregroundColor(Forest.accent)
                    }
                }
                .frame(height: 140)
            }
        }
    }
}

// MARK: - Project Card

struct ProjectCard: View {
    let project: Project

    var body: some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            HStack {
                Image(systemName: project.projectType.icon)
                    .font(.system(size: 14))
                    .foregroundColor(Forest.accent)
                Spacer()
                Text(project.projectType == .pro ? "PRO" : "STD")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(Forest.accent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Forest.accent.opacity(0.15))
                    .cornerRadius(4)
            }

            Spacer()

            Text(project.name)
                .font(.system(size: Forest.textBase, weight: .semibold))
                .foregroundColor(Forest.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            HStack(spacing: Forest.space2) {
                if let count = project.fileCount, count > 0 {
                    Label("\(count)", systemImage: "doc.fill")
                        .font(.system(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                }
                Text(project.formattedDate)
                    .font(.system(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
            }
        }
        .padding(Forest.space3)
        .frame(height: 140)
        .background(Forest.backgroundSecondary)
        .cornerRadius(Forest.radiusMd)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusMd)
                .stroke(Forest.border, lineWidth: 1)
        )
    }
}
