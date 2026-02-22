import SwiftUI

struct OutOfCreditsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var credits = CreditsService.shared

    var body: some View {
        NavigationStack {
            VStack(spacing: Forest.space6) {
                Spacer()

                VStack(spacing: Forest.space4) {
                    Image(systemName: "circle.hexagongrid.fill")
                        .font(.system(size: 56))
                        .foregroundColor(Forest.error.opacity(0.6))

                    Text("Out of Credits")
                        .font(.system(size: Forest.text2Xl, weight: .bold))
                        .foregroundColor(Forest.textPrimary)

                    Text("You need credits to send messages and build apps. Buy a credit pack or upgrade your plan to continue.")
                        .font(.system(size: Forest.textBase))
                        .foregroundColor(Forest.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Forest.space4)
                }

                VStack(spacing: Forest.space3) {
                    NavigationLink(destination: CreditsView()) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Buy Credits")
                        }
                        .font(.system(size: Forest.textBase, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(Forest.space3)
                        .background(Forest.accent)
                        .cornerRadius(Forest.radiusSm)
                    }

                    Button {
                        dismiss()
                    } label: {
                        Text("Maybe Later")
                            .font(.system(size: Forest.textBase, weight: .medium))
                            .foregroundColor(Forest.textTertiary)
                    }
                }
                .padding(.horizontal, Forest.space8)

                Spacer()
            }
            .background(Forest.backgroundPrimary)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}
