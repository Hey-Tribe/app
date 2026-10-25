# HeyTribe iPhone app: setup and App Store listing

The app in `mobile/` is a native iPhone shell around www.heytribe.app/app. Website updates show up in the
app right away, so most changes never need a new App Store build. A new build is only needed when something
in `mobile/` changes (icon, plugins, permissions).

## What's built

- iPhone app project (bundle ID `app.heytribe.ios`, iOS 15+, iPhone only, English and Spanish)
- Icon and launch screen
- Sign in with Apple (native sheet) and Google (secure sign-in window). Setup: `docs/SIGN_IN_SETUP.md`
- Premium through Apple in-app purchase, with Restore purchases and Manage subscription
- Server check of every Apple purchase (`/api/apple-verify`) and Apple's renewal and refund notices (`/api/apple-notifications`)
- Reminders through Apple push (`api/_apns.js`), same schedule as web reminders
- Links outside the app open in an in-app Safari sheet
- Universal links: www.heytribe.app/app links open the app once `APPLE_TEAM_ID` is set
- No Google Analytics inside the iPhone app
- Offline screen if the phone has no connection on launch
- Cloud build to TestFlight: GitHub › Actions › "iPhone app to TestFlight"

## Steps only you can do

1. **Join the Apple Developer Program** ($99/year) at developer.apple.com/programs. To enroll as the company you need a
   D-U-N-S number (free, takes a few days).
2. **Create the app in App Store Connect** (appstoreconnect.apple.com › Apps › +):
   - Platform iOS, name **HeyTribe**, primary language English (U.S.), bundle ID **app.heytribe.ios**, SKU `heytribe-ios`.
   - On developer.apple.com › Identifiers › app.heytribe.ios, turn on **Push Notifications** and **Associated Domains**.
3. **Create the subscription** (the app › Monetization › Subscriptions):
   - Group name "HeyTribe Premium". Two products in the same group:
     **app.heytribe.premium.yearly**, 1 year, $39.99 (put it first in the group), and **app.heytribe.premium.monthly**, 1 month, $4.99.
   - Introductory offer on both: free for 2 weeks, new subscribers. This matches the 14-day trial on the web.
   - Display name "Premium", description "Every extra for your whole family".
   - Accept the Paid Apps agreement and add bank and tax details under Business, or purchases won't load.
4. **App Store Server Notifications** (the app › App Information): set the production and sandbox URLs to
   `https://www.heytribe.app/api/apple-notifications`, Version 2.
5. **Push key**: developer.apple.com › Keys › + › Apple Push Notifications service. Download the .p8 file once.
6. **API key for cloud builds**: App Store Connect › Users and Access › Integrations › App Store Connect API › +, role App Manager.
   Download the .p8 file once.
7. **Send me (or add yourself)**:
   - Vercel environment variables: `APPLE_TEAM_ID`, `APNS_KEY_ID`, `APNS_TEAM_ID` (same as Team ID), `APNS_KEY_P8` (whole push .p8 file).
   - GitHub repository secrets: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (whole API .p8 file).
8. **Build**: GitHub › Actions › "iPhone app to TestFlight" › Run workflow. The build shows up in TestFlight in about 20 minutes.
   Install TestFlight on your iPhone to try it.
9. **Review account**: make a login for Apple's reviewers (for example review@heytribe.app) with a family that has a few
   plans, chores and a list in it. Put the login in App Review Information.
10. Add screenshots, fill in the listing below, and submit for review.

## Listing

**Name:** HeyTribe

**Subtitle (30):** Family calendar, chores, lists

**Promotional text (170):** One shared place for your family's plans, chores, groceries, meals and reminders. Free to start.

**Description:**

HeyTribe keeps your family's week in one place that everyone can see.

Plan: a shared calendar with who's going, who's driving and repeating plans. Subscribe to it from Apple or Google Calendar.

Chores and stars: give each kid their chores, and they earn stars for finishing them. Kids get their own simple screen.

Lists and meals: groceries, to-dos and a weekly meal plan that adds ingredients to the list.

Health and home: medicine times, checkups, bills and school forms, with a reminder before each one.

The fridge: quick notes and countdowns to the big days.

Invite your partner, grandparents or a sitter. Everyone sees the same thing as soon as it changes. Parents approve who joins.

Works in English and Spanish.

Premium ($4.99 a month or $39.99 a year for the whole family) adds every extra. You can cancel anytime in your Apple ID settings.

Terms: https://www.heytribe.app/terms.html
Privacy: https://www.heytribe.app/privacy.html

**Keywords (100):** family,calendar,chores,planner,organizer,grocery,list,meal,kids,schedule,shared,reminders,parents

**Category:** Productivity (secondary: Lifestyle)

**Age rating:** 4+ (no objectionable content). Answer "No" to everything except "Unrestricted web access", which is also No (the app only opens heytribe.app).

**Support URL:** https://www.heytribe.app/contact.html  **Marketing URL:** https://www.heytribe.app  **Privacy policy URL:** https://www.heytribe.app/privacy.html

**Copyright:** 2026 Kopimore Hospitality Group (adjust to the legal owner)

## App privacy answers

Tracking: **No**. The app does not track people across other companies' apps or websites.

Data collected, all **linked to the user**, none used for tracking:

| Data type | Purpose |
|---|---|
| Contact info: email address, name | App functionality |
| Health: medicine schedules and checkups people enter | App functionality |
| User content: photos, documents, plans, notes | App functionality |
| Identifiers: user ID | App functionality |
| Purchases: purchase history | App functionality |
| Diagnostics: crash data (error reports) | App functionality |
| Usage data: product interaction (page views, not linked to ads) | Analytics |

## Notes for App Review

> HeyTribe is a shared family organizer. Sign in with the review account below to see a sample family.
> Premium is an auto-renewing monthly subscription offered through in-app purchase (Family › Your plan).
> Reminders use push notifications and can be turned on in Family › Reminders.
> Account deletion: Family › Delete account.

## Screenshots

App Store Connect needs 6.9-inch iPhone screenshots (1320 × 2868). Suggested screens: Today, Plan (calendar), Chores with stars,
Lists, Kids screen, Family. Spanish screenshots can be added under the Spanish (Mexico) localization.
