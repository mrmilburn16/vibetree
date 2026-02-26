import Foundation

actor APIService {
    static let shared = APIService()

    private var baseURL: String {
        UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.12.40:3001"
    }

    private var apiToken: String {
        get async {
            let keychain = await AuthService.shared.currentToken
            if let keychain, !keychain.isEmpty { return keychain }
            return UserDefaults.standard.string(forKey: "apiToken") ?? ""
        }
    }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    private func request(_ path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = await apiToken
        if !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body
        req.timeoutInterval = 10

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.httpError(http.statusCode, String(data: data, encoding: .utf8))
        }
        return data
    }

    // MARK: - Build Jobs

    func fetchBuildJob(id: String) async throws -> BuildJob? {
        let data = try await request("/api/build-jobs/\(id)")
        let response = try decoder.decode(BuildJobResponse.self, from: data)
        return response.job
    }

    func fetchActiveBuilds() async throws -> [BuildJob] {
        let data = try await request("/api/build-jobs/active")
        let response = try decoder.decode(ActiveBuildJobsResponse.self, from: data)
        return response.jobs
    }

    func fetchRecentBuilds() async throws -> [BuildJob] {
        let data = try await request("/api/build-jobs/recent")
        let response = try decoder.decode(ActiveBuildJobsResponse.self, from: data)
        return response.jobs
    }

    // MARK: - Projects

    func fetchProjects() async throws -> [Project] {
        let data = try await request("/api/projects")
        let response = try decoder.decode(ProjectListResponse.self, from: data)
        return response.projects
    }

    func createProject(name: String, type: ProjectType) async throws -> Project {
        let body = try JSONEncoder().encode(CreateProjectRequest(name: name, projectType: type.rawValue))
        let data = try await request("/api/projects", method: "POST", body: body)
        let response = try decoder.decode(CreateProjectResponse.self, from: data)
        return response.project
    }

    func deleteProject(id: String) async throws {
        _ = try await request("/api/projects/\(id)", method: "DELETE")
    }

    func fetchProject(id: String) async throws -> Project {
        let data = try await request("/api/projects/\(id)")
        return try decoder.decode(Project.self, from: data)
    }

    /// Returns raw JSON data from the project endpoint (includes fileCount/filePaths not in Project model).
    func fetchProjectRaw(id: String) async throws -> Data {
        return try await request("/api/projects/\(id)")
    }

    func updateProject(id: String, name: String?, bundleId: String?) async throws -> Project {
        var body: [String: Any] = [:]
        if let name { body["name"] = name }
        if let bundleId { body["bundleId"] = bundleId }
        let data = try JSONSerialization.data(withJSONObject: body)
        let responseData = try await request("/api/projects/\(id)", method: "PATCH", body: data)
        return try decoder.decode(Project.self, from: responseData)
    }

    // MARK: - Chat / Messaging

    func streamMessageRequest(projectId: String, message: String, model: String, projectType: String) async throws -> URLRequest {
        guard let url = URL(string: "\(baseURL)/api/projects/\(projectId)/message/stream") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token = await apiToken
        if !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.timeoutInterval = 600
        let payload: [String: Any] = [
            "message": message,
            "model": model,
            "projectType": projectType,
            "useRealLLM": true
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)
        return req
    }

    // MARK: - Preflight (Run on iPhone readiness)

    func fetchPreflight(projectId: String, teamId: String = "") async throws -> PreflightResponse {
        var path = "/api/macos/preflight?projectId=\(projectId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? projectId)"
        if !teamId.isEmpty {
            path += "&teamId=\(teamId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? teamId)"
        }
        let data = try await request(path)
        return try decoder.decode(PreflightResponse.self, from: data)
    }

    // MARK: - Build / Install

    func triggerBuild(projectId: String) async throws -> BuildJob {
        let data = try await request("/api/projects/\(projectId)/validate-xcode", method: "POST")
        let response = try decoder.decode(BuildJobResponse.self, from: data)
        guard let job = response.job else { throw APIError.invalidResponse }
        return job
    }

    func exportXcodeURL(projectId: String) -> URL? {
        URL(string: "\(baseURL)/api/projects/\(projectId)/export-xcode")
    }

    func triggerDeviceInstall(projectId: String) async throws -> String {
        let payload: [String: Any] = ["projectName": "Untitled app"]
        let body = try JSONSerialization.data(withJSONObject: payload)
        let data = try await request("/api/projects/\(projectId)/build-install", method: "POST", body: body)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let job = json?["job"] as? [String: Any]
        guard let jobId = job?["id"] as? String else { throw APIError.invalidResponse }
        return jobId
    }

    // MARK: - Credits

    func fetchCredits() async throws -> CreditBalanceResponse {
        let data = try await request("/api/credits")
        return try decoder.decode(CreditBalanceResponse.self, from: data)
    }

    // MARK: - Device Registration

    func registerDevice(token: String, activityPushToken: String? = nil) async throws {
        let reg = DeviceRegistration(deviceToken: token, activityPushToken: activityPushToken)
        let body = try JSONEncoder().encode(reg)
        _ = try await request("/api/devices/register", method: "POST", body: body)
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case .invalidResponse: return "Invalid response from server"
        case .httpError(let code, let body):
            if let body,
               let data = body.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = json["error"] as? String {
                return msg
            }
            return "HTTP \(code): \(body ?? "Unknown error")"
        }
    }
}
