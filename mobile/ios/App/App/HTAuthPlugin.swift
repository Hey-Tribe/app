import Foundation
import UIKit
import Capacitor
import AuthenticationServices

/// The app's own screen: Capacitor's web view plus HeyTribe's native sign-in plugin.
class HeyTribeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HTAuthPlugin())
    }
}

/// Native sign-in for the HeyTribe web app.
///  - apple({ nonce }): Sign in with Apple sheet, returns the identity token for Supabase.
///  - webAuth({ url, scheme }): opens a sign-in page (Google) in Apple's secure sign-in browser and returns the callback URL.
@objc(HTAuthPlugin)
public class HTAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "HTAuthPlugin"
    public let jsName = "HTAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "apple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "webAuth", returnType: CAPPluginReturnPromise)
    ]

    private var appleCall: CAPPluginCall?
    private var webSession: ASWebAuthenticationSession?

    @objc func apple(_ call: CAPPluginCall) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        if let nonce = call.getString("nonce") { request.nonce = nonce }
        appleCall = call
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = appleCall else { return }
        appleCall = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            call.reject("Apple didn't return a sign-in token", "failed")
            return
        }
        call.resolve([
            "identityToken": token,
            "user": credential.user,
            "email": credential.email ?? "",
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? ""
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = appleCall else { return }
        appleCall = nil
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("Canceled", "canceled")
        } else {
            call.reject(error.localizedDescription, "failed")
        }
    }

    @objc func webAuth(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), let scheme = call.getString("scheme") else {
            call.reject("Missing sign-in address", "failed")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.webSession = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let sessionError = error as? ASWebAuthenticationSessionError, sessionError.code == .canceledLogin {
                    call.reject("Canceled", "canceled")
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in didn't finish", "failed")
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webSession = session
            if !session.start() {
                self.webSession = nil
                call.reject("Couldn't open sign-in", "failed")
            }
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return anchor()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return anchor()
    }

    private func anchor() -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window { return window }
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        return scene?.windows.first(where: { $0.isKeyWindow }) ?? scene?.windows.first ?? ASPresentationAnchor()
    }
}
