import SwiftUI

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

            Text("Use the same email and password as the website to access your projects and credits.")
                .font(Forest.font(size: Forest.textSm))
                .foregroundColor(Forest.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Forest.space6)
                .padding(.top, Forest.space2)

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
}
