import Foundation

struct Project: Codable, Identifiable {
    let id: String
    var name: String
    var projectType: ProjectType
    let createdAt: Double
    var fileCount: Int?

    var createdDate: Date {
        Date(timeIntervalSince1970: createdAt / 1000)
    }

    var formattedDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: createdDate, relativeTo: Date())
    }
}

enum ProjectType: String, Codable, CaseIterable {
    case standard
    case pro

    var displayName: String {
        switch self {
        case .standard: return "Standard (Expo)"
        case .pro: return "Pro (Swift)"
        }
    }

    var icon: String {
        switch self {
        case .standard: return "apps.iphone"
        case .pro: return "swift"
        }
    }
}

struct ProjectListResponse: Codable {
    let projects: [Project]
}

struct CreateProjectRequest: Codable {
    let name: String
    let projectType: String
}

struct CreateProjectResponse: Codable {
    let project: Project
}
