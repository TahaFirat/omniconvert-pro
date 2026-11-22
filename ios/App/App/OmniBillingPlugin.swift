import Foundation
import UIKit
import StoreKit
import Capacitor

@objc(OmniBillingPlugin)
public class OmniBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmniBillingPlugin"
    public let jsName = "OmniBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchaseProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAppStoreReview", returnType: CAPPluginReturnPromise)
    ]

    /// Native StoreKit 2 In-App Purchase (Guideline 3.1.1 compliant — zero external checkout).
    @objc public func purchaseProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product \(productId) is not configured in App Store Connect yet.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve([
                            "success": true,
                            "transactionId": String(transaction.id),
                            "productId": transaction.productID
                        ])
                    case .unverified(_, let error):
                        call.reject("Transaction verification failed: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve([
                        "success": false,
                        "productId": productId
                    ])
                case .pending:
                    call.resolve([
                        "success": false,
                        "productId": productId
                    ])
                @unknown default:
                    call.resolve([
                        "success": false,
                        "productId": productId
                    ])
                }
            } catch {
                call.reject("StoreKit 2 purchase error: \(error.localizedDescription)")
            }
        }
    }

    /// Native StoreKit 2 Restore Purchases (Mandatory per Apple App Store Guideline 3.1.1).
    @objc public func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var restoredIds: [String] = []
                var isPro = false

                for await verification in Transaction.currentEntitlements {
                    if case .verified(let transaction) = verification {
                        restoredIds.append(transaction.productID)
                        if transaction.productID.contains(".pro.") {
                            isPro = true
                        }
                    }
                }

                call.resolve([
                    "isPro": isPro,
                    "restoredProductIds": restoredIds
                ])
            } catch {
                call.reject("StoreKit 2 restore error: \(error.localizedDescription)")
            }
        }
    }

    /// Native App Store Review Prompt (called only after 3rd successful on-device conversion).
    @objc public func requestAppStoreReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                AppStore.requestReview(in: scene)
                call.resolve(["presented": true])
            } else {
                call.resolve(["presented": false])
            }
        }
    }
}
