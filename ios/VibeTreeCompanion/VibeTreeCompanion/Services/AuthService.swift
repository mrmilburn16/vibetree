import Foundation
import Security

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var userEmail: String?
    @Published var isLoading = false
    @Published var error: String?

    private let keychainService = "com.vibetree.companion"
    private let keychainAccount = "session_token"

    init() {
        if let token = loadTokenFromKeychain() {
            isAuthenticated = true
            userEmail = UserDefaults.standard.string(forKey: "vibetree-user-email")
            _ = token
        }
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let token = try await performSignIn(email: email, password: password)
            saveTokenToKeychain(token)
            userEmail = email
            UserDefaults.standard.set(email, forKey: "vibetree-user-email")
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() {
        deleteTokenFromKeychain()
        userEmail = nil
        UserDefaults.standard.removeObject(forKey: "vibetree-user-email")
        isAuthenticated = false
    }

    // MARK: - API

    private func performSignIn(email: String, password: String) async throws -> String {
        let baseURL = UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3001"
        guard let url = URL(string: "\(baseURL)/api/auth/login") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        req.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw APIError.httpError(code, "Sign in failed")
        }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let token = json["token"] as? String {
            return token
        }
        throw APIError.invalidResponse
    }

    // MARK: - Keychain

    private func saveTokenToKeychain(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecValueData as String: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func loadTokenFromKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(query as CFDictionary)
    }
}
