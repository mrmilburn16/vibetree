import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @StateObject private var auth = AuthService.shared
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: Forest.space8) {
            Spacer()

            branding

            VStack(spacing: Forest.space4) {
                emailField
                passwordField
                signInButton
            }
            .padding(.horizontal, Forest.space6)

            dividerRow

            appleSignIn
                .padding(.horizontal, Forest.space6)

            if let error = auth.error {
                Text(error)
                    .font(Forest.font(size: Forest.textSm))
                    .foregroundColor(Forest.error)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Forest.space6)
            }

            Spacer()
            Spacer()
        }
        .background(Forest.backgroundPrimary)
        .ignoresSafeArea(.keyboard)
    }

    // MARK: - Branding

    private var branding: some View {
        VStack(spacing: Forest.space3) {
            Image(systemName: "tree.fill")
                .font(Forest.font(size: 56))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Forest.accent, Forest.accentLight],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )
            HStack(spacing: 10) {
                Text("Vibetree")
                    .font(Forest.font(size: Forest.text3Xl, weight: .bold))
                    .foregroundColor(Forest.textPrimary)
                Text("BETA")
                    .font(Forest.font(size: 10, weight: .medium))
                    .tracking(1)
                    .textCase(.uppercase)
                    .foregroundColor(Forest.textTertiary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .overlay(
                        RoundedRectangle(cornerRadius: Forest.radiusSm)
                            .stroke(Forest.border, lineWidth: 1)
                    )
            }
            Text("Build apps from your phone")
                .font(Forest.font(size: Forest.textBase))
                .foregroundColor(Forest.textTertiary)
        }
    }

    // MARK: - Fields

    private var emailField: some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            Text("Email")
                .font(Forest.font(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
            TextField("you@example.com", text: $email)
                .textFieldStyle(.plain)
                .forestInput()
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: Forest.space1) {
            Text("Password")
                .font(Forest.font(size: Forest.textXs, weight: .medium))
                .foregroundColor(Forest.textTertiary)
            SecureField("••••••••", text: $password)
                .textFieldStyle(.plain)
                .forestInput()
                .textContentType(.password)
        }
    }

    private var signInButton: some View {
        Button {
            Task { await auth.signIn(email: email, password: password) }
        } label: {
            HStack {
                if auth.isLoading {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.8)
                } else {
                    Text("Sign In")
                        .font(Forest.font(size: Forest.textBase, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(Forest.space3)
            .background(canSignIn ? Forest.accent : Forest.accent.opacity(0.4))
            .foregroundColor(.white)
            .cornerRadius(Forest.radiusSm)
        }
        .disabled(!canSignIn || auth.isLoading)
    }

    private var canSignIn: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        !password.isEmpty
    }

    // MARK: - Divider

    private var dividerRow: some View {
        HStack {
            Rectangle()
                .fill(Forest.border)
                .frame(height: 1)
            Text("or")
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .padding(.horizontal, Forest.space2)
            Rectangle()
                .fill(Forest.border)
                .frame(height: 1)
        }
        .padding(.horizontal, Forest.space6)
    }

    // MARK: - Apple Sign In

    private var appleSignIn: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.email, .fullName]
        } onCompletion: { result in
            switch result {
            case .success(let auth):
                if let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                   let data = credential.identityToken,
                   let token = String(data: data, encoding: .utf8) {
                    self.auth.isAuthenticated = true
                    self.auth.userEmail = credential.email
                    _ = token
                }
            case .failure:
                break
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 48)
        .cornerRadius(Forest.radiusSm)
    }
}
