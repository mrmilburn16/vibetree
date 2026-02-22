import Foundation

@MainActor
final class ProjectService: ObservableObject {
    static let shared = ProjectService()

    @Published var projects: [Project] = []
    @Published var isLoading = false
    @Published var error: String?

    func fetchProjects() async {
        isLoading = true
        error = nil
        do {
            projects = try await APIService.shared.fetchProjects()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func createProject(name: String, type: ProjectType = .pro) async -> Project? {
        do {
            let project = try await APIService.shared.createProject(name: name, type: type)
            projects.insert(project, at: 0)
            return project
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteProject(id: String) async {
        do {
            try await APIService.shared.deleteProject(id: id)
            projects.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
