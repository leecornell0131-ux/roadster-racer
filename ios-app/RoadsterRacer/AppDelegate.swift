import UIKit

// 로드스터 레이서 아이폰 앱.
// 게임은 웹 버전(index.html + src/ + assets/)을 앱 안에 그대로 넣고 WKWebView로 띄움.
// 인터넷 없이도 돌아가고(글꼴만 온라인), 진동은 아이폰 햅틱으로 바꿔 줌 (GameViewController).
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = GameViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    // 게임 중에는 화면이 꺼지지 않게
    func applicationDidBecomeActive(_ application: UIApplication) {
        application.isIdleTimerDisabled = true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        application.isIdleTimerDisabled = false
    }
}
