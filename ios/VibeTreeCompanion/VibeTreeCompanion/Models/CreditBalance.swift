import Foundation

struct CreditBalanceResponse: Codable {
    let balance: Int
    let monthlyAllowance: Int?
    let resetDate: String?
}

struct CreditPack: Identifiable {
    let id: String
    let credits: Int
    let price: String
    let priceValue: Double

    static let packs: [CreditPack] = [
        CreditPack(id: "pack_50", credits: 50, price: "$5", priceValue: 5.0),
        CreditPack(id: "pack_100", credits: 100, price: "$10", priceValue: 10.0),
        CreditPack(id: "pack_250", credits: 250, price: "$25", priceValue: 25.0),
        CreditPack(id: "pack_500", credits: 500, price: "$50", priceValue: 50.0)
    ]
}
