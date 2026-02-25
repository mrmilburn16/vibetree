import SwiftUI

struct ShareSheet: View {
    let project: Project
    @Environment(\.dismiss) private var dismiss
    @State private var shareURL = ""
    @State private var copied = false
    @State private var inviteEmail = ""
    @State private var inviteStatus: InviteStatus?

    enum InviteStatus {
        case sending
        case success(String)
        case error(String)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Forest.space5) {
                    shareLinkSection
                    inviteTestersSection
                    publishSection
                }
                .padding(Forest.space4)
            }
            .background(Forest.backgroundPrimary)
            .navigationTitle("Share")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundColor(Forest.accent)
                }
            }
            .onAppear {
                let base = UserDefaults.standard.string(forKey: "serverURL") ?? "https://vibetree.app"
                shareURL = "\(base)/share/\(project.id)"
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Share Link

    private var shareLinkSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            Label("Share link", systemImage: "link")
                .font(.system(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textPrimary)

            HStack {
                Text(shareURL)
                    .font(.system(size: Forest.textXs, design: .monospaced))
                    .foregroundColor(Forest.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer()

                Button {
                    UIPasteboard.general.string = shareURL
                    withAnimation { copied = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        withAnimation { copied = false }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                        Text(copied ? "Copied" : "Copy")
                            .font(.system(size: Forest.textXs, weight: .medium))
                    }
                    .foregroundColor(copied ? Forest.success : Forest.accent)
                    .padding(.horizontal, Forest.space2)
                    .padding(.vertical, 6)
                    .background(Forest.backgroundTertiary)
                    .cornerRadius(Forest.radiusSm)
                }
            }
        }
        .forestCard()
    }

    // MARK: - Invite Testers

    private var inviteTestersSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            Label("Invite testers", systemImage: "person.badge.plus")
                .font(.system(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textPrimary)

            Text("Send an invite to test your app via email.")
                .font(.system(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)

            HStack(spacing: Forest.space2) {
                TextField("email@example.com", text: $inviteEmail)
                    .font(.system(size: Forest.textSm))
                    .foregroundColor(Forest.inputText)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .forestInput()

                Button {
                    sendInvite()
                } label: {
                    if case .sending = inviteStatus {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.7)
                    } else {
                        Text("Send")
                            .font(.system(size: Forest.textSm, weight: .semibold))
                    }
                }
                .buttonStyle(ForestPrimaryButtonStyle(isDisabled: inviteEmail.isEmpty))
                .disabled(inviteEmail.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if let status = inviteStatus {
                switch status {
                case .sending:
                    EmptyView()
                case .success(let msg):
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(Forest.success)
                        Text(msg)
                            .foregroundColor(Forest.success)
                    }
                    .font(.system(size: Forest.textXs))
                case .error(let msg):
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Forest.error)
                        Text(msg)
                            .foregroundColor(Forest.error)
                    }
                    .font(.system(size: Forest.textXs))
                }
            }
        }
        .forestCard()
    }

    // MARK: - Publish (Coming Soon)

    private var publishSection: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            HStack {
                Label("Publish to App Store", systemImage: "shippingbox")
                    .font(.system(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.textPrimary)

                Spacer()

                Text("Coming soon")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Forest.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Forest.accent.opacity(0.12))
                    .cornerRadius(Forest.radiusSm)
            }

            Text("Submit your app to the App Store directly from VibeTree. We handle code signing, screenshots, and metadata.")
                .font(.system(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
        }
        .forestCard()
        .opacity(0.6)
    }

    // MARK: - Networking

    private func sendInvite() {
        let email = inviteEmail.trimmingCharacters(in: .whitespaces)
        guard !email.isEmpty else { return }

        inviteStatus = .sending

        Task {
            do {
                let baseURL = UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.12.40:3001"
                guard let url = URL(string: "\(baseURL)/api/projects/\(project.id)/invite-testers") else {
                    inviteStatus = .error("Invalid server URL")
                    return
                }
                var req = URLRequest(url: url)
                req.httpMethod = "POST"
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")

                if let token = AuthService.shared.currentToken, !token.isEmpty {
                    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }

                req.httpBody = try JSONSerialization.data(withJSONObject: ["emails": [email]])

                let (data, response) = try await URLSession.shared.data(for: req)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                    inviteStatus = .error("Failed to send invite.")
                    return
                }

                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    inviteStatus = .success(message)
                } else {
                    inviteStatus = .success("Invite sent to \(email)")
                }
                inviteEmail = ""
            } catch {
                inviteStatus = .error(error.localizedDescription)
            }
        }
    }
}
