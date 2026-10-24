import UIKit
import WebKit

// 게임 화면. 앱에 넣은 web/ 폴더를 app://game/ 주소로 열어 줌.
// file:// 로 열면 ES 모듈(import)과 fetch가 막혀서, 앱이 직접 파일을 내주는 주소를 씀.
class GameViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    static let scheme = "app"
    static let startURL = URL(string: "app://game/index.html")!

    private var web: WKWebView!
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)

    // iOS WebKit에는 navigator.vibrate가 없음. 게임은 vibrate가 있으면 그걸 쓰므로(src/game.js haptic)
    // 같은 이름으로 앱 햅틱에 연결해 줌. 패턴은 [진동, 쉼, 진동, ...] ms.
    private static let vibrateShim = """
    navigator.vibrate = function (p) {
      try { window.webkit.messageHandlers.haptic.postMessage(Array.isArray(p) ? p : [p]); } catch (e) {}
      return true;
    };
    """

    override func loadView() {
        let config = WKWebViewConfiguration()
        // 진행·도지코인 저장(localStorage)이 앱을 껐다 켜도 남게
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(BundleFiles(root: Bundle.main.resourceURL!.appendingPathComponent("web")), forURLScheme: Self.scheme)
        config.userContentController.add(self, name: "haptic")
        config.userContentController.addUserScript(WKUserScript(source: Self.vibrateShim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // 효과음(Web Audio)이 첫 터치 전에도 준비되게
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        let ver = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        config.applicationNameForUserAgent = "RoadsterRacerIOS/\(ver)"

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.043, green: 0.027, blue: 0.086, alpha: 1) // index.html --ink
        web.allowsBackForwardNavigationGestures = false
        // 노치·홈 바 여백은 게임 HUD가 env(safe-area-inset-*)로 직접 처리 (viewport-fit=cover)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: Self.startURL))
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    // 화면 가장자리 스와이프(제어 센터·홈)가 운전 중 터치에 바로 걸리지 않게 한 번 더 밀어야 열리도록
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }

    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "haptic", let pat = message.body as? [Any] else { return }
        let ms = pat.compactMap { ($0 as? NSNumber)?.doubleValue }
        var at = 0.0
        for (i, d) in ms.enumerated() {
            if i % 2 == 0 && d > 0 {
                let g = d < 10 ? light : d < 30 ? medium : heavy
                DispatchQueue.main.asyncAfter(deadline: .now() + at / 1000) { g.impactOccurred() }
            }
            at += d
        }
    }

    // 웹 콘텐츠 프로세스가 메모리 부족으로 꺼지면 흰 화면 대신 다시 불러옴 (저장은 localStorage에 남아 있음)
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.startURL))
    }

    // 게임 밖 링크(크레딧 등)는 Safari로
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme != Self.scheme, action.targetFrame?.isMainFrame ?? true,
           url.scheme == "http" || url.scheme == "https" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

// app://game/경로 요청에 앱 안의 web/경로 파일을 내줌
final class BundleFiles: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }

    static let types: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
        "json": "application/json", "css": "text/css", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "webp": "image/webp", "svg": "image/svg+xml", "glb": "model/gltf-binary", "bin": "application/octet-stream",
        "wasm": "application/wasm", "mp3": "audio/mpeg", "ogg": "audio/ogg", "wav": "audio/wav", "m4a": "audio/mp4",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish()
            return
        }
        let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
