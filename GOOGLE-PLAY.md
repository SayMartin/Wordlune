# Publishing Wordlune to Google Play

Everything that must happen before the Android app can go on the Play Store, and everything that is already done so it isn't redone.

**Not started deliberately** — the GDPR work this depends on is complete, but publishing was postponed. iOS/App Store is out of scope: there is no active Apple developer account.

App identity, for every form that asks:

| | |
|---|---|
| Package name | `se.wordlune.app` (permanent once uploaded — cannot be changed) |
| Display name | Wordlune |
| Privacy policy URL | `https://wordlune.appfinningar.se/privacy` |
| Account deletion URL | `https://wordlune.appfinningar.se/delete-account` |
| Support email | `support@appfinningar.se` |
| Target audience | 13+ |

---

## Already done — do not redo

These landed with the GDPR work and are in the repo now.

- **Permissions stripped to `INTERNET` only.** `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` and `VIBRATE` are removed via `tools:node="remove"` in `android/app/src/main/AndroidManifest.xml`. They merge in from React Native / Expo library manifests, so deleting the lines alone would not have worked. `SYSTEM_ALERT_WINDOW` in particular is a Play policy flag.
- **`android:allowBackup="false"`.** Auto Backup was uploading AsyncStorage — including the Supabase session token, which embeds the access token, refresh token and the user's email address — to the user's Google Drive.
- **Deep-link intent-filter** for `se.wordlune.app://`, matching the redirect URLs `AuthContext` already builds. Paired with `linking.prefixes` in `App.tsx`.
- **Privacy policy screen** at `/privacy`, translated en/sv/fr, reachable without a session.
- **Account deletion screen** at `/delete-account`, also reachable without a session, with an email fallback for users who can't sign in.
- **`.gitignore` already covers `*.keystore`** (with an exception for `debug.keystore`), so a new upload keystore is ignored automatically.
- **`targetSdkVersion` is 36** (`minSdk 24`, `compileSdk 36`) via Expo SDK 57's `expo-root-project` plugin defaults — already above Play's floor. Nothing to change; just confirm it in the merged manifest before uploading.

---

## Blockers in the code

### 1. Release builds are signed with the debug keystore

`android/app/build.gradle`, in `buildTypes.release`:

```gradle
// Caution! In production, you need to generate your own keystore file.
signingConfig signingConfigs.debug
```

Play rejects debug-signed uploads. Generate an upload key:

```sh
keytool -genkeypair -v -keystore wordlune-upload.keystore -alias wordlune-upload \
        -keyalg RSA -keysize 2048 -validity 10000
```

Keep the file **outside the repo**. Put the credentials in `~/.gradle/gradle.properties` (machine-local, same pattern the project already uses for `org.gradle.java.home`):

```properties
WORDLUNE_UPLOAD_STORE_FILE=/absolute/path/to/wordlune-upload.keystore
WORDLUNE_UPLOAD_STORE_PASSWORD=...
WORDLUNE_UPLOAD_KEY_ALIAS=wordlune-upload
WORDLUNE_UPLOAD_KEY_PASSWORD=...
```

Then add a `release` signing config guarded on those properties, falling back to debug when they're absent so `expo run:android --variant release` still works on a machine without the keystore:

```gradle
signingConfigs {
    debug { /* unchanged */ }
    release {
        if (findProperty('WORDLUNE_UPLOAD_STORE_FILE')) {
            storeFile file(WORDLUNE_UPLOAD_STORE_FILE)
            storePassword WORDLUNE_UPLOAD_STORE_PASSWORD
            keyAlias WORDLUNE_UPLOAD_KEY_ALIAS
            keyPassword WORDLUNE_UPLOAD_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig findProperty('WORDLUNE_UPLOAD_STORE_FILE')
            ? signingConfigs.release
            : signingConfigs.debug
        // ... rest unchanged
    }
}
```

**Enrol in Play App Signing** when creating the app. Google then holds the actual app signing key and you hold only the upload key — which means losing the upload key is recoverable. Without it, losing the key means you can never update the app again.

### 2. Version numbers

Currently `versionCode 1` / `versionName "0.0.1"`, matching `app.config.js` and `package.json`.

`versionCode 1` is fine for a first upload. Bump `versionName` to `"1.0.0"` and keep all three files in step.

Every later upload needs `versionCode` incremented. Play rejects a reused `versionCode` **permanently** — even for a build that was never released.

---

## Play Console setup

### The timeline gotcha — start this first

A **personal** Google Play developer account (as opposed to an organisation account) created after November 2023 must run a **closed test with at least 12 testers who stay opted in for 14 continuous days** before production access is granted.

That is the long pole. Everything else here takes hours; this takes two weeks minimum, and the clock only starts once you have 12 people actually enrolled. If a tester drops out and the count falls below 12, the counter can reset.

The account itself costs a one-off 25 USD.

### App content declarations

| Section | Answer |
|---|---|
| Privacy policy | `https://wordlune.appfinningar.se/privacy` |
| Data deletion | "I provide a way for users to request that some or all of their data is deleted" → `https://wordlune.appfinningar.se/delete-account`, and describe the in-app path: Settings → Danger Zone → Delete Account |
| Ads | None |
| Content rating | Complete the IARC questionnaire — a word game with no violence, no gambling, no user-to-user free text |
| Target audience | **13+**. Do **not** select a children's age band: that triggers the Families policy and Teacher Approved review, which this app is not built for |
| App access | "Play as Guest" needs no credentials, so reviewers can reach everything. Say so, or supply a test account |
| Government app | No |
| Financial features | None |

### Data safety form

The app has **no analytics, no crash reporting, no advertising SDKs and no tracking** — verified by grep across `package.json` and `src/` (zero matches for sentry/firebase/amplitude/segment/posthog and friends). Answer accordingly; these are honest "no"s, not convenient ones.

**Does your app collect or share any of the required user data types?** Yes.

| Data type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required | Account management, App functionality |
| Personal info → Name (display name) | Yes | No | Required | Account management, App functionality |
| Personal info → User IDs | Yes | No | Required | Account management, App functionality |
| App activity → Other actions (scores, challenge results, duel history) | Yes | No | Required | App functionality |
| App info and performance → Crash logs | **No** | | | |
| App info and performance → Diagnostics | **No** | | | |

- **Analytics** as a purpose: **No**, on every row.
- **Data shared with third parties: No.** Supabase, Resend and Cloudflare are processors acting on your instructions, which Play's definition of "sharing" excludes. Keep the DPAs on file in case it's queried.
- **Security practices:** "Data is encrypted in transit" — yes. "Users can request that data be deleted" — yes. "Independent security review" — no.

Guest accounts still collect a User ID and gameplay data, so those rows stay "Yes" even though a guest supplies no email.

---

## Build and upload

```sh
cd android
./gradlew :app:bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```

Android builds need the Gradle daemon on **Java 17 or 21** — JDK 24+ trips a JNI-restriction warning during the prefab/CMake steps that AGP misreports as a build failure. Pin it via `org.gradle.java.home` in `~/.gradle/gradle.properties`, not in the repo's `android/gradle.properties`. (See `CLAUDE.md`.)

---

## Pre-upload verification

Run all of these against the actual release build, not the source.

```sh
# Permissions: expect INTERNET and nothing else
./gradlew :app:processReleaseManifest
grep uses-permission android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml

# allowBackup must be false, targetSdk must be 36
grep -o 'allowBackup="[^"]*"' android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml

# Signature: must be the upload key, not androiddebugkey
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab | head

# Deep link opens the app
adb shell am start -a android.intent.action.VIEW -d "se.wordlune.app://reset-password"
```

Manually, on a real device with the release build:

- Sign up → the two consent checkboxes block submission until ticked
- Play as Guest → privacy notice visible, policy link opens
- Settings → Data & Privacy → Download my data → share sheet appears, file is valid JSON
- Settings → Danger Zone → Delete Account → account is actually gone
- Both `/privacy` and `/delete-account` load in a browser from a cold direct hit, signed out

---

## Loose ends worth deciding before launch

- **Guest → registered upgrade is implemented but untested end to end.** `signUpNewUser()` branches on `session.user.is_anonymous` and takes an `updateUser({ email, password })` path, which converts the account in place and keeps the same `auth.users.id` — so scores, duels and profile carry over with no data migration. What has *not* been exercised on a real device is the confirmation step: the account stays `is_anonymous = true` until the emailed link is clicked, and on Android that link has to come back through the `se.wordlune.app://auth-callback` deep link. The intent-filter exists now, but the round trip has never been completed. **Test this before launch** — a half-finished upgrade leaves a player believing they have an account when they still have a guest session.

- **Android App Links** (`assetlinks.json` on the domain) would make `https://wordlune.appfinningar.se/...` open the app directly rather than the browser. Not required — the custom scheme covers the auth redirects — but nice, and it makes the Play-registered URLs feel native.
- **Email confirmation on native** still isn't wired end-to-end. The intent-filter now exists, so the redirect can land; it hasn't been tested on a device.
- **Store listing assets** — feature graphic (1024×500), phone screenshots, short and full description. None exist yet. Worth writing in all three supported languages, since the app is en/sv/fr.
- **Re-check the retention copy** in the privacy policy against the live cron jobs before launch. The policy states 14 days for guests, 6 months + 14 for inactive registered accounts; those must keep matching `20260818_cleanup_anonymous_users.sql` and `20260819_warn_and_cleanup_inactive_registered_users.sql`.
