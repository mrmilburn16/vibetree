import SwiftUI

// MARK: - Coins icon (two interlocking circles, matches web CreditsWidget IconCoins)
private struct CreditsCoinsIcon: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24
            let r: CGFloat = 6 * scale
            let c1 = CGPoint(x: 10 * scale, y: 14 * scale)
            let c2 = CGPoint(x: 14 * scale, y: 10 * scale)
            context.stroke(
                Path(ellipseIn: CGRect(x: c1.x - r, y: c1.y - r, width: 2 * r, height: 2 * r)),
                with: .color(Forest.textSecondary),
                lineWidth: 2
            )
            context.stroke(
                Path(ellipseIn: CGRect(x: c2.x - r, y: c2.y - r, width: 2 * r, height: 2 * r)),
                with: .color(Forest.textSecondary),
                lineWidth: 2
            )
        }
        .frame(width: 18, height: 18)
    }
}

// MARK: - Credits widget pill only (trigger); dropdown is presented by parent overlay to avoid toolbar clipping
struct CreditBalanceView: View {
    @ObservedObject var credits: CreditsService
    @Binding var isDropdownOpen: Bool

    var body: some View {
        Button {
            isDropdownOpen.toggle()
        } label: {
            HStack(spacing: Forest.space2) {
                CreditsCoinsIcon()
                Text("\(credits.balance)")
                    .font(Forest.fontMono(size: Forest.textSm, weight: .semibold))
                    .foregroundColor(Forest.semanticSuccess)
                Text(credits.balance == 1 ? "credit" : "credits")
                    .font(Forest.font(size: Forest.textSm, weight: .medium))
                    .foregroundColor(credits.isLow ? Forest.accent.opacity(0.8) : Forest.textTertiary)
                Image(systemName: "chevron.down")
                    .font(Forest.font(size: 12, weight: .semibold))
                    .foregroundColor(Forest.textTertiary)
                    .rotationEffect(.degrees(isDropdownOpen ? 180 : 0))
                    .animation(.easeOut(duration: 0.2), value: isDropdownOpen)
            }
            .padding(.horizontal, Forest.space3)
            .padding(.vertical, Forest.space2)
            .background(Forest.backgroundSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(credits.isLow ? Forest.accent.opacity(0.5) : Forest.border, lineWidth: 1)
            )
            .cornerRadius(Forest.radiusMd)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Credits balance and options")
        .accessibilityHint(isDropdownOpen ? "Double tap to close menu" : "Double tap to open menu")
    }
}

// MARK: - Credits dropdown panel (matches web CreditsWidget menu exactly: structure, padding, tap targets)
struct CreditsDropdownContent: View {
    @ObservedObject var credits: CreditsService
    @Binding var isOpen: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Balance section — border-b, px-4 py-3
            VStack(alignment: .leading, spacing: 4) {
                Text("Balance")
                    .font(Forest.font(size: Forest.textXs, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
                Text("\(credits.balance) \(credits.balance == 1 ? "credit" : "credits")")
                    .font(Forest.font(size: Forest.textXl, weight: .semibold))
                    .foregroundColor(Forest.textPrimary)
                Text("1 message = 1 credit\nResets monthly")
                    .font(Forest.font(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
                    .lineSpacing(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Forest.space4)
            .padding(.vertical, Forest.space3)
            .background(Forest.backgroundSecondary)

            Rectangle()
                .fill(Forest.border)
                .frame(height: 1)

            if credits.isLow && !credits.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Running low on credits")
                        .font(Forest.font(size: Forest.textSm))
                        .foregroundColor(Forest.accent)
                    Text("Buy more to keep building")
                        .font(Forest.font(size: Forest.textXs))
                        .foregroundColor(Forest.textTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Forest.space4)
                .padding(.vertical, Forest.space2)
                .background(Forest.backgroundSecondary)

                Rectangle()
                    .fill(Forest.border)
                    .frame(height: 1)
            }

            // Actions — px-2 py-2 (web), full-width buttons with generous tap area
            VStack(spacing: Forest.space2) {
                NavigationLink(destination: CreditsView()) {
                    Text("Buy credits")
                        .font(Forest.font(size: Forest.textSm, weight: .medium))
                        .foregroundColor(Forest.buttonPrimaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                }
                .simultaneousGesture(TapGesture().onEnded { isOpen = false })
                .background(Forest.buttonPrimaryBg)
                .cornerRadius(Forest.radiusMd)

                Button {
                    isOpen = false
                    openPricingURL()
                } label: {
                    Text("View plans")
                        .font(Forest.font(size: Forest.textSm))
                        .foregroundColor(Forest.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Forest.space2)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(Forest.space2)
            .background(Forest.backgroundSecondary)
        }
        .frame(minWidth: 220)
        .background(Forest.backgroundSecondary)
        .cornerRadius(Forest.radiusLg)
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusLg)
                .stroke(Forest.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
    }

    private func openPricingURL() {
        let base = UserDefaults.standard.string(forKey: "serverURL") ?? "http://192.168.12.40:3001"
        let path = base.hasSuffix("/") ? "pricing" : "/pricing"
        guard let url = URL(string: base + path) else { return }
        UIApplication.shared.open(url)
    }
}
