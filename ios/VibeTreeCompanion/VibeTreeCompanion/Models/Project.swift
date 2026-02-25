import Foundation

struct Project: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var projectType: ProjectType
    let createdAt: Double
    var updatedAt: Double?
    var fileCount: Int?

    var createdDate: Date {
        Date(timeIntervalSince1970: createdAt / 1000)
    }

    var lastTouchedDate: Date {
        Date(timeIntervalSince1970: (updatedAt ?? createdAt) / 1000)
    }

    var formattedDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: lastTouchedDate, relativeTo: Date())
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
