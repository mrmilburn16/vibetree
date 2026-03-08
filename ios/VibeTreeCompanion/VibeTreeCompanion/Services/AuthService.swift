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
        // Don't touch Auth.auth() here — Firebase may not be configured yet (instant crash).
        // State is refreshed in refreshAuthState() called from RootView.task.
    }

    /// Sign in with email and password using Firebase Auth directly — same user as the web app (signInWithEmailAndPassword).
    /// This ensures the same Firebase UID, so credits, projects, and build history in Firestore are shared.
    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        do {
            let result = try await signInWithEmailPassword(email: trimmedEmail, password: password)
            let idToken = try await result.user.getIDToken()
            guard !idToken.isEmpty else {
                throw APIError.invalidResponse
            }
            saveTokenToKeychain(idToken)
            userEmail = result.user.email ?? trimmedEmail
            UserDefaults.standard.set(userEmail, forKey: "vibetree-user-email")
            isAuthenticated = true
        } catch {
            self.error = firebaseAuthErrorMessage(error)
        }
        isLoading = false
    }

    private func signInWithEmailPassword(email: String, password: String) async throws -> AuthDataResult {
        try await withCheckedThrowingContinuation { continuation in
            Auth.auth().signIn(withEmail: email, password: password) { authResult, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let authResult = authResult else {
                    continuation.resume(throwing: APIError.invalidResponse)
                    return
                }
                continuation.resume(returning: authResult)
            }
        }
    }

    private func firebaseAuthErrorMessage(_ error: Error) -> String {
        let nsError = error as NSError
        // Firebase Auth error domain (FIRAuthErrorDomain)
        guard nsError.domain == "FIRAuthErrorDomain" else {
            return error.localizedDescription
        }
        switch nsError.code {
        case 17011, 17009, 17010: // .userNotFound, .wrongPassword, .invalidCredential
            return "Invalid email or password."
        case 17008: // .invalidEmail
            return "Invalid email address."
        case 17005: // .userDisabled
            return "This account has been disabled."
        case 17020: // .networkError
            return "Network error. Check your connection and try again."
        default:
            return error.localizedDescription
        }
    }

    func signOut() {
        try? Auth.auth().signOut()
        deleteTokenFromKeychain()
        userEmail = nil
        UserDefaults.standard.removeObject(forKey: "vibetree-user-email")
        isAuthenticated = false
    }

    /// Call after launch so we don't access Auth before FirebaseApp.configure(). Updates isAuthenticated and userEmail.
    func refreshAuthState() {
        if let user = Auth.auth().currentUser {
            isAuthenticated = true
            userEmail = user.email ?? UserDefaults.standard.string(forKey: "vibetree-user-email")
        } else if loadTokenFromKeychain() != nil {
            isAuthenticated = true
            userEmail = UserDefaults.standard.string(forKey: "vibetree-user-email")
        }
    }

    /// Returns a valid Firebase ID token for API requests, refreshing if needed (tokens expire after ~1 hour).
    func getValidIDToken() async -> String? {
        if let user = Auth.auth().currentUser {
            if let token = try? await user.getIDToken(forcingRefresh: false), !token.isEmpty {
                saveTokenToKeychain(token)
                return token
            }
        }
        return loadTokenFromKeychain()
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
