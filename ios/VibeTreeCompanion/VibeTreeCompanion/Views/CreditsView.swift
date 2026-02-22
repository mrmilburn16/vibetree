import SwiftUI

struct CreditsView: View {
    @StateObject private var credits = CreditsService.shared

    private let columns = [
        GridItem(.flexible(), spacing: Forest.space4),
        GridItem(.flexible(), spacing: Forest.space4)
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: Forest.space6) {
                balanceCard
                packsGrid
                infoSection
            }
            .padding(Forest.space4)
        }
        .background(Forest.backgroundPrimary)
        .navigationTitle("Credits")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await credits.fetchBalance()
        }
    }

    // MARK: - Balance

    private var balanceCard: some View {
        VStack(spacing: Forest.space3) {
            Text("Current Balance")
                .font(.system(size: Forest.textSm, weight: .medium))
                .foregroundColor(Forest.textTertiary)

            HStack(alignment: .firstTextBaseline, spacing: Forest.space2) {
                Text("\(credits.balance)")
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(balanceColor)
                Text("credits")
                    .font(.system(size: Forest.textLg, weight: .medium))
                    .foregroundColor(Forest.textTertiary)
            }

            if credits.isLow && !credits.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                    Text("Running low")
                        .font(.system(size: Forest.textXs, weight: .medium))
                }
                .foregroundColor(Forest.warning)
            }

            Text("\(credits.monthlyAllowance) included monthly")
                .font(.system(size: Forest.textXs))
                .foregroundColor(Forest.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .forestCard()
    }

    private var balanceColor: Color {
        if credits.isEmpty { return Forest.error }
        if credits.isLow { return Forest.warning }
        return Forest.accent
    }

    // MARK: - Packs

    private var packsGrid: some View {
        VStack(alignment: .leading, spacing: Forest.space3) {
            Text("Buy Credits")
                .font(.system(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textTertiary)
                .textCase(.uppercase)
                .tracking(0.8)

            LazyVGrid(columns: columns, spacing: Forest.space4) {
                ForEach(CreditPack.packs) { pack in
                    PackCard(pack: pack) {
                        credits.add(pack.credits)
                    }
                }
            }
        }
    }

    // MARK: - Info

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: Forest.space2) {
            Text("How credits work")
                .font(.system(size: Forest.textSm, weight: .semibold))
                .foregroundColor(Forest.textTertiary)
                .textCase(.uppercase)
                .tracking(0.8)

            VStack(alignment: .leading, spacing: Forest.space3) {
                creditRow("1 AI chat message", cost: "1 credit")
                creditRow("1 premium chat (Opus)", cost: "3 credits")
                creditRow("1 build", cost: "5 credits")
                creditRow("1 Run on device", cost: "10 credits")
                creditRow("1 App Store publish", cost: "25 credits")
            }
            .forestCard()
        }
    }

    private func creditRow(_ action: String, cost: String) -> some View {
        HStack {
            Text(action)
                .font(.system(size: Forest.textSm))
                .foregroundColor(Forest.textSecondary)
            Spacer()
            Text(cost)
                .font(.system(size: Forest.textSm, weight: .medium, design: .monospaced))
                .foregroundColor(Forest.accent)
        }
    }
}

// MARK: - Pack Card

struct PackCard: View {
    let pack: CreditPack
    let onPurchase: () -> Void

    var body: some View {
        Button(action: onPurchase) {
            VStack(spacing: Forest.space2) {
                Text("\(pack.credits)")
                    .font(.system(size: Forest.text2Xl, weight: .bold, design: .rounded))
                    .foregroundColor(Forest.textPrimary)
                Text("credits")
                    .font(.system(size: Forest.textXs))
                    .foregroundColor(Forest.textTertiary)
                Text(pack.price)
                    .font(.system(size: Forest.textBase, weight: .semibold))
                    .foregroundColor(Forest.accent)
            }
            .frame(maxWidth: .infinity)
            .padding(Forest.space4)
            .background(Forest.backgroundSecondary)
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(Forest.border, lineWidth: 1)
            )
        }
    }
}
