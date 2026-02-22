import SwiftUI

struct CreditBalanceView: View {
    @ObservedObject var credits: CreditsService

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "circle.hexagongrid.fill")
                .font(.system(size: 12))
                .foregroundColor(badgeColor)
            Text("\(credits.balance)")
                .font(.system(size: Forest.textSm, weight: .bold, design: .monospaced))
                .foregroundColor(badgeColor)
        }
        .padding(.horizontal, Forest.space2)
        .padding(.vertical, 4)
        .background(badgeColor.opacity(0.12))
        .cornerRadius(Forest.radiusSm)
    }

    private var badgeColor: Color {
        if credits.isEmpty { return Forest.error }
        if credits.isLow { return Forest.warning }
        return Forest.accent
    }
}
