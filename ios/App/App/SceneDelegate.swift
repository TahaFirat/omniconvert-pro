import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let rootVC = MainViewController()
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = rootVC
        window?.makeKeyAndVisible()

        rootVC.webView?.scrollView.contentInsetAdjustmentBehavior = .never

        if !connectionOptions.urlContexts.isEmpty {
            importIncomingURLs(connectionOptions.urlContexts)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        importIncomingURLs(URLContexts)
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// Copies files opened via iOS Files App / Open-In into a private temp inbox for immediate offline inspection.
    private func importIncomingURLs(_ contexts: Set<UIOpenURLContext>) {
        let inboxDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("omniconvert_inbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: inboxDir, withIntermediateDirectories: true)

        for ctx in contexts {
            let srcURL = ctx.url
            guard srcURL.isFileURL else { continue }
            let accessed = srcURL.startAccessingSecurityScopedResource()
            defer {
                if accessed { srcURL.stopAccessingSecurityScopedResource() }
            }
            let destURL = inboxDir.appendingPathComponent(srcURL.lastPathComponent)
            try? FileManager.default.removeItem(at: destURL)
            try? FileManager.default.copyItem(at: srcURL, to: destURL)
        }
    }
}
