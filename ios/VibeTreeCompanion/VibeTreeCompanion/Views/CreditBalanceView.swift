import SwiftUI

struct CreditBalanceView: View {
    @ObservedObject var credits: CreditsService

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "circle.hexagongrid.fill")
                .font(.system(size: 12))
                .foregroundColor(iconColor)
            Text("\(credits.balance)")
                .font(.system(size: Forest.textSm, weight: .bold, design: .monospaced))
                .foregroundColor(Forest.semanticSuccess)
        }
        .padding(.horizontal, Forest.space2)
        .padding(.vertical, 4)
        .background(iconColor.opacity(0.12))
        .cornerRadius(Forest.radiusSm)
    }

    private var iconColor: Color {
        if credits.isEmpty { return Forest.error }
        if credits.isLow { return Forest.warning }
        return Forest.accent
    }
}
