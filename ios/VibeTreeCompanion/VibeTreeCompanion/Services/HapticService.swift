import UIKit

/// Central haptic feedback for the app. Use different levels so light actions feel subtle
/// and important actions feel deliberate. Devices without a Taptic Engine ignore these calls.
enum HapticService {
    /// Selection changed (picker, segmented control, chip choice). Subtle.
    static func selection() {
        let g = UISelectionFeedbackGenerator()
        g.prepare()
        g.selectionChanged()
    }

    /// Light impact – toggles, opening/closing UI, small taps.
    static func light() {
        let g = UIImpactFeedbackGenerator(style: .light)
        g.prepare()
        g.impactOccurred()
    }

    /// Medium impact – primary actions (Send, Build It, Save). Standard button feel.
    static func medium() {
        let g = UIImpactFeedbackGenerator(style: .medium)
        g.prepare()
        g.impactOccurred()
    }

    /// Heavy impact – high-commitment actions (Delete, Sign Out, destructive).
    static func heavy() {
        let g = UIImpactFeedbackGenerator(style: .heavy)
        g.prepare()
        g.impactOccurred()
    }

    /// Success – build completed, save succeeded.
    static func success() {
        let g = UINotificationFeedbackGenerator()
        g.prepare()
        g.notificationOccurred(.success)
    }

    /// Warning – e.g. low credits, recoverable issue.
    static func warning() {
        let g = UINotificationFeedbackGenerator()
        g.prepare()
        g.notificationOccurred(.warning)
    }

    /// Error – build failed, request failed.
    static func error() {
        let g = UINotificationFeedbackGenerator()
        g.prepare()
        g.notificationOccurred(.error)
    }
}
