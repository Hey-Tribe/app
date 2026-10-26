# Sign in with Apple and Google: setup

The app is ready. "Continue with Apple" and "Continue with Google" appear on the log-in and sign-up screens
by themselves as soon as each one is switched on in Supabase. Nothing needs to be redeployed.

- **Website:** the buttons send people to Apple or Google and back to www.heytribe.app/app.
- **iPhone app:** Apple uses the built-in Sign in with Apple sheet (Face ID). Google opens Apple's secure sign-in window.
- **Android app:** both open in a browser tab and come back to the app.
- If someone already has a HeyTribe login with the same email, they land in the same account.
- New people go straight to "Start your tribe" or "Join with a code", with their first name filled in.

## 1. Supabase redirect addresses (once)

Supabase › Authentication › URL Configuration:
- Site URL: `https://www.heytribe.app/app/`
- Redirect URLs: add `https://www.heytribe.app/app/`, `https://www.heytribe.app/app/**`, `app.heytribe.ios://auth` and `app.heytribe.android://auth`

## 2. Google

1. Go to console.cloud.google.com. Create a project named HeyTribe (or use an existing one).
2. APIs & Services › OAuth consent screen:
   - App name HeyTribe, support email hello@heytribe.app, logo, home page https://www.heytribe.app.
   - Privacy https://www.heytribe.app/privacy.html, terms https://www.heytribe.app/terms.html.
   - Authorized domain: heytribe.app. Scopes: email, profile, openid.
   - Publish the app (move it out of Testing).
3. APIs & Services › Credentials › Create credentials › OAuth client ID:
   - Type: Web application.
   - Authorized JavaScript origins: `https://www.heytribe.app`
   - Authorized redirect URIs: `https://ayafbypcbsfmqckuwqom.supabase.co/auth/v1/callback`
4. Supabase › Authentication › Sign In / Providers › Google: turn it on and paste the Client ID and Client Secret. Save.

## 3. Apple (needs the Apple Developer account)

On developer.apple.com › Certificates, Identifiers & Profiles:

1. **Identifiers › app.heytribe.ios**: turn on **Sign In with Apple** (the iPhone app uses this).
2. **Identifiers › + › Services IDs**: description "HeyTribe web", identifier **app.heytribe.web**.
   - Turn on Sign In with Apple › Configure, primary App ID app.heytribe.ios.
   - Domains: `ayafbypcbsfmqckuwqom.supabase.co`
   - Return URL: `https://ayafbypcbsfmqckuwqom.supabase.co/auth/v1/callback`
3. **Keys › +**: name "HeyTribe Sign in with Apple", turn on Sign in with Apple, configure with app.heytribe.ios.
   Download the .p8 file (only once) and note the Key ID.
4. Make the secret key for Supabase. From the repo, run:
   `node tools/apple-client-secret.mjs AuthKey_XXXX.p8 <Key ID> <Team ID>`
   Or send me the .p8 file, Key ID and Team ID and I'll make it.
5. Supabase › Authentication › Sign In / Providers › Apple: turn it on.
   - Client IDs: `app.heytribe.web,app.heytribe.ios`
   - Secret Key: paste the result from step 4. Save.
6. **The Apple secret key expires every 6 months.** Make a new one with step 4 before then, or Apple sign-in stops working
   on the website. It keeps working in the iPhone app either way.

## Apple's rule

Apple requires Sign in with Apple in the iPhone app whenever Google sign-in is offered there. Both are built in.
If Google is switched on but Apple isn't yet, the iPhone app would be rejected, so switch on Apple before submitting.
