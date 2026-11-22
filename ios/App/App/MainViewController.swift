import UIKit
import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    private static let lightBg = UIColor(red: 0.949, green: 0.949, blue: 0.969, alpha: 1.0) // #F2F2F7
    private static let darkBg = UIColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1.0)  // #09090B
    private static let amoledBg = UIColor.black

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OmniNativeEnginePlugin())
        bridge?.registerPluginInstance(OmniBillingPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        let adaptiveBg = UIColor { trait in
            trait.userInterfaceStyle == .dark ? MainViewController.darkBg : MainViewController.lightBg
        }
        applyBackground(adaptiveBg)
        configureScrollViewLock()
    }

    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        configureScrollViewLock()
    }

    private func configureScrollViewLock() {
        guard let webView = self.webView else { return }
        webView.isOpaque = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
    }

    private func applyBackground(_ color: UIColor) {
        view.backgroundColor = color
        view.window?.backgroundColor = color
        if let webView = self.webView {
            webView.backgroundColor = color
            webView.scrollView.backgroundColor = color
        }
    }

    @objc public func applyThemeMode(_ mode: String) {
        DispatchQueue.main.async {
            switch mode {
            case "light":
                self.overrideUserInterfaceStyle = .light
                self.applyBackground(MainViewController.lightBg)
            case "amoled":
                self.overrideUserInterfaceStyle = .dark
                self.applyBackground(MainViewController.amoledBg)
            case "dark":
                self.overrideUserInterfaceStyle = .dark
                self.applyBackground(MainViewController.darkBg)
            default:
                self.overrideUserInterfaceStyle = .unspecified
                let adaptiveBg = UIColor { trait in
                    trait.userInterfaceStyle == .dark ? MainViewController.darkBg : MainViewController.lightBg
                }
                self.applyBackground(adaptiveBg)
            }
        }
    }
}
