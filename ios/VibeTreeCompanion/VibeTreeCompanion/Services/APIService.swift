import Foundation

actor APIService {
    static let shared = APIService()

    private var baseURL: String {
        UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3001"
    }

    private var apiToken: String {
        UserDefaults.standard.string(forKey: "apiToken") ?? ""
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
        if !apiToken.isEmpty {
            req.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
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
            return "HTTP \(code): \(body ?? "Unknown error")"
        }
    }
}
