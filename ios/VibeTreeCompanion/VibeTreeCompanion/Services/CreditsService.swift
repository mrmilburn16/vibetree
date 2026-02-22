import Foundation

@MainActor
final class CreditsService: ObservableObject {
    static let shared = CreditsService()

    @Published var balance: Int = 50
    @Published var monthlyAllowance: Int = 50
    @Published var isLoading = false
    @Published var error: String?

    static let lowCreditThreshold = 10

    var isLow: Bool { balance <= Self.lowCreditThreshold }
    var isEmpty: Bool { balance <= 0 }

    func fetchBalance() async {
        isLoading = true
        do {
            let response = try await APIService.shared.fetchCredits()
            balance = response.balance
            if let allowance = response.monthlyAllowance {
                monthlyAllowance = allowance
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func hasCreditsForMessage() -> Bool {
        balance >= 1
    }

    func deduct(_ amount: Int = 1) {
        balance = max(0, balance - amount)
    }

    func add(_ amount: Int) {
        balance += amount
    }
}
