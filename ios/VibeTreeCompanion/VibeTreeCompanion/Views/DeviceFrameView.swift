import SwiftUI

struct DeviceFrameView<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            notch

            content()
                .clipShape(RoundedRectangle(cornerRadius: Forest.radiusMd))
        }
        .background(Forest.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Forest.radiusXl))
        .overlay(
            RoundedRectangle(cornerRadius: Forest.radiusXl)
                .stroke(Forest.borderSubtle, lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.3), radius: 20, y: 8)
    }

    private var notch: some View {
        HStack {
            Spacer()
            RoundedRectangle(cornerRadius: 4)
                .fill(Forest.backgroundTertiary)
                .frame(width: 120, height: 28)
                .padding(.top, 8)
            Spacer()
        }
    }
}
