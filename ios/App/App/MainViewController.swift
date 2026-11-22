import UIKit
import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OmniNativeEnginePlugin())
        bridge?.registerPluginInstance(OmniBillingPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        let bg = UIColor.black
        view.backgroundColor = bg
        if let webView = self.webView {
            webView.isOpaque = false
            webView.backgroundColor = bg
            webView.scrollView.backgroundColor = bg
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            webView.scrollView.bounces = true
        }
    }
}
