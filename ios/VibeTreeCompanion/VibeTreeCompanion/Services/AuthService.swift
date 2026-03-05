import Foundation
import Security
import FirebaseAuth

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var userEmail: String?
    @Published var isLoading = false
    @Published var error: String?

    private let keychainService = "com.vibetree.companion"
    private let keychainAccount = "session_token"

    var currentToken: String? {
        loadTokenFromKeychain()
    }

    init() {
        if let user = Auth.auth().currentUser {
            isAuthenticated = true
            userEmail = user.email ?? UserDefaults.standard.string(forKey: "vibetree-user-email")
        } else if loadTokenFromKeychain() != nil {
            isAuthenticated = true
            userEmail = UserDefaults.standard.string(forKey: "vibetree-user-email")
        }
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let customToken = try await fetchCustomToken(email: email, password: password)
            let cred = try await Auth.auth().signIn(withCustomToken: customToken)
            guard let idToken = try await cred.user.getIDToken() else {
                throw APIError.invalidResponse
            }
            saveTokenToKeychain(idToken)
            userEmail = cred.user.email ?? email
            UserDefaults.standard.set(userEmail, forKey: "vibetree-user-email")
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() {
        try? Auth.auth().signOut()
        deleteTokenFromKeychain()
        userEmail = nil
        UserDefaults.standard.removeObject(forKey: "vibetree-user-email")
        isAuthenticated = false
    }

    /// Returns a valid Firebase ID token for API requests, refreshing if needed (tokens expire after ~1 hour).
    func getValidIDToken() async -> String? {
        if let user = Auth.auth().currentUser {
            if let token = try? await user.getIDTokenForcingRefresh(false) {
                saveTokenToKeychain(token)
                return token
            }
        }
        return loadTokenFromKeychain()
    }

    // MARK: - API

    private func fetchCustomToken(email: String, password: String) async throws -> String {
        let baseURL = UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.12.40:3001"
        guard let url = URL(string: "\(baseURL)/api/auth/login") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        req.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8)
            throw APIError.httpError(http.statusCode, body)
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
