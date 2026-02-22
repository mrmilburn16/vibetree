import SwiftUI

enum Forest {
    // MARK: - Backgrounds
    static let backgroundPrimary   = Color(hex: "0A0A0B")
    static let backgroundSecondary = Color(hex: "141416")
    static let backgroundTertiary  = Color(hex: "1C1C1E")

    // MARK: - Accent (Emerald)
    static let accent              = Color(hex: "10B981")
    static let accentLight         = Color(hex: "34D399")
    static let accentLightest      = Color(hex: "6EE7B7")

    // MARK: - Text
    static let textPrimary         = Color(hex: "FAFAFA")
    static let textSecondary       = Color(hex: "A1A1AA")
    static let textTertiary        = Color(hex: "71717A")

    // MARK: - Borders
    static let border              = Color(hex: "27272A")
    static let borderSubtle        = Color(hex: "3F3F46")

    // MARK: - Semantic
    static let success             = Color(hex: "22C55E")
    static let warning             = Color(hex: "EAB308")
    static let error               = Color(hex: "EF4444")

    // MARK: - Buttons
    static let buttonSecondaryBg   = Color(hex: "27272A")
    static let buttonSecondaryHover = Color(hex: "3F3F46")
    static let destructiveText     = Color(hex: "F87171")

    // MARK: - Progress bar track
    static let progressTrack       = Color(hex: "27272A")

    // MARK: - Spacing (matches 4px base from tokens.css)
    static let space1:  CGFloat = 4
    static let space2:  CGFloat = 8
    static let space3:  CGFloat = 12
    static let space4:  CGFloat = 16
    static let space5:  CGFloat = 20
    static let space6:  CGFloat = 24
    static let space8:  CGFloat = 32
    static let space10: CGFloat = 40
    static let space12: CGFloat = 48

    // MARK: - Radii
    static let radiusSm: CGFloat = 8
    static let radiusMd: CGFloat = 12
    static let radiusLg: CGFloat = 16
    static let radiusXl: CGFloat = 24

    // MARK: - Font sizes
    static let textXs:  CGFloat = 12
    static let textSm:  CGFloat = 14
    static let textBase: CGFloat = 16
    static let textLg:  CGFloat = 18
    static let textXl:  CGFloat = 20
    static let text2Xl: CGFloat = 24
    static let text3Xl: CGFloat = 32
}

struct ForestProgressBarStyle: ProgressViewStyle {
    var height: CGFloat = 8

    func makeBody(configuration: Configuration) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(Forest.progressTrack)
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(
                        LinearGradient(
                            colors: [Forest.accent, Forest.accentLight],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geo.size.width * (configuration.fractionCompleted ?? 0))
            }
        }
        .frame(height: height)
    }
}

struct ForestCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Forest.space4)
            .background(Forest.backgroundSecondary)
            .cornerRadius(Forest.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: Forest.radiusMd)
                    .stroke(Forest.border, lineWidth: 1)
            )
    }
}

extension View {
    func forestCard() -> some View {
        modifier(ForestCardModifier())
    }
}
