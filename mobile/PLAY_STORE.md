# HeyTribe Android app: setup and Google Play listing

The Android app in `mobile/android` is the same HeyTribe app as the website, inside a native Android shell.
Website updates show up in the app right away. A new Play build is only needed when something in `mobile/` changes.

## What's built

- Android app ID `app.heytribe.android`, Android 7 (API 24) and newer, targets the current Android API (36)
- Adaptive icon, round icon, launch screen, notification icon, Play Store icon (`store/android/icon-512.png`) and feature graphic (`store/android/feature-graphic.png`)
- Sign in with Apple or Google: opens a browser tab, then comes back to the app (`app.heytribe.android://auth`)
- Back button: closes an open sheet, then goes back to Today, then leaves the app in the background
- Reminders through Firebase Cloud Messaging (switched on once Firebase is set up, see below)
- Links to www.heytribe.app/app open the app once the signing fingerprint is added (`/.well-known/assetlinks.json`)
- The login is not copied into Google Drive backups or phone-to-phone transfers
- Cloud build: GitHub › Actions › "Mobile apps" builds an installable test app (APK) and the Play Store bundle (AAB). It also opens the app on an emulator and saves screenshots.

**Premium on Android:** not sold in the Android app yet. Google requires Google Play Billing for in-app subscriptions, and the server check for Google purchases isn't built. Families on Android get the 14-day trial and the free plan. People who already pay on the web or iPhone keep Premium on Android, because Premium belongs to the family.

## Try it on your phone now

1. Open the latest "Mobile apps" run in GitHub Actions and download **android-builds**. Unzip it.
2. Send `HeyTribe-test.apk` to your Android phone and open it. Allow "install unknown apps" for that one app when asked.
3. This test build is signed with a development key, so it can't be updated from Play later. Uninstall it before installing the Play version.

## Steps only you can do

1. **Google Play Console** ($25 one-time) at play.google.com/console. A company account needs a D-U-N-S number. New personal accounts must run a closed test with at least 12 testers for 14 days before going to production.
2. **Create the app:** name HeyTribe, default language English (United States), app, free.
3. **Upload key:** make one on your computer (run this once and keep the file and passwords safe):
   `keytool -genkeypair -v -keystore heytribe-upload.jks -alias heytribe -keyalg RSA -keysize 2048 -validity 10000`
   Then add GitHub repository secrets:
   - `ANDROID_UPLOAD_KEYSTORE_B64`: run `base64 -i heytribe-upload.jks` and paste the output
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`heytribe`), `ANDROID_KEY_PASSWORD`
   Play App Signing holds the real app key. If the upload key is ever lost, Google can reset it.
4. **Firebase for reminders:** project **HeyTribe** (`heytribe-e26d5`) is set up under admin@squaredawaylabs.com, with the Android app `app.heytribe.android` registered and Cloud Messaging (V1) on. Analytics and Gemini are off. Two steps left:
   - Project settings › General › HeyTribe Android › download `google-services.json`. Paste its contents into GitHub › Hey-Tribe/app › Settings › Secrets and variables › Actions as `GOOGLE_SERVICES_JSON`.
   - Project settings › Service accounts › Generate new private key. Paste the whole JSON into Vercel (Production) as `FCM_SERVICE_ACCOUNT`, then delete the downloaded file.
   - Tell me when this is done and I'll switch on `androidPush`. Don't switch it on before a new build has the Firebase file, or Android test builds without it will close when reminders are turned on.
5. **App links:** after the first upload, copy the SHA-256 fingerprints from Play Console › Test and release › App integrity (both the app signing key and the upload key). Add them comma-separated to Vercel as `ANDROID_CERT_SHA256`.
6. **Sign-in:** add `app.heytribe.android://auth` to Supabase redirect URLs (see `docs/SIGN_IN_SETUP.md`).
7. **First release:** run "Mobile apps" with the version (for example 1.0). Download `HeyTribe-release.aab` and upload it to the Internal testing track. Add your own Google account as a tester and install it from the Play Store link.

## Listing

**App name:** HeyTribe

**Short description (80):** Family calendar, chores, groceries and reminders, shared with everyone at home.

**Full description:**

HeyTribe keeps your family's week in one place that everyone can see.

Plan: a shared calendar with who's going, who's driving and repeating plans. Subscribe to it from Google, Apple or Outlook calendars.

Chores and stars: give each kid their chores, and they earn stars for finishing them. Kids get their own simple screen.

Lists and meals: groceries, to-dos and a weekly dinner menu.

Health and home: medicine times, checkups, bills and school forms, with a reminder before each one.

The fridge: quick notes and countdowns to the big days.

Invite your partner, grandparents or a sitter. Everyone sees changes as soon as they happen. Parents approve who joins.

Works in English and Spanish. Every new family gets 14 days of Premium free.

**Category:** Productivity. **Tags:** Family, Calendar, Organizer.
**Contact:** hello@heytribe.app, https://www.heytribe.app
**Privacy policy:** https://www.heytribe.app/privacy.html
**Account deletion URL:** https://www.heytribe.app/delete-account.html

**Graphics:** icon `store/android/icon-512.png`, feature graphic `store/android/feature-graphic.png`. For phone screenshots, use the ones in `screenshots/`; Play accepts 1320 × 2868.

## Content rating

Run the questionnaire as a Productivity app. Answer "No" to violence, sexuality, language, controlled substances and gambling. People can share content with each other only inside their own invited family, and the family is approved by a parent. Expected rating: Everyone.

## Data safety form

- Data is encrypted in transit: **Yes**
- People can request deletion: **Yes** (in the app, and at the account deletion URL)
- Shared with third parties: **No.** Service providers that process data on HeyTribe's behalf don't count as sharing.

| Data type | Collected | Optional? | Purpose |
|---|---|---|---|
| Personal info: name, email address | Yes | Required | App functionality, account management |
| Health and fitness: health info (medicine schedules, checkups people enter) | Yes | Optional | App functionality |
| Photos and videos: photos | Yes | Optional | App functionality (document photos) |
| Files and docs | Yes | Optional | App functionality (PDFs) |
| Calendar: calendar events | Yes | Optional | App functionality |
| App activity: other user-generated content (lists, notes, chores) | Yes | Optional | App functionality |
| App info and performance: crash logs | Yes | Required | App functionality (error reports, not linked to the person) |
| Device or other IDs | Yes | Optional | App functionality (notification token, when reminders are on) |

The Android app doesn't load Google Analytics. Don't declare advertising, location, contacts or financial data.

## Review notes and testing access

Give Play the same reviewer login as Apple (see `APP_STORE.md`). In "App access", say that some features need a family. The reviewer login opens a filled-in sample family.
