# helpme — Project Guide

## What this project is

A **native Android app** (Expo SDK 54 + React Native 0.81 + Hermes)
targeting Google Play Store. Vercel hosts the backend API only.

**There is no web client.** It was removed. Do NOT:

- Add `react-native-web`, `react-dom`, or `expo export -p web`.
- Add `web` scripts to `package.json` or a `web` section to `app.json`.
- Add a `dist/` folder, an `index.html`, or any static-site assets.
- Use browser APIs in JS (`window`, `document`, `localStorage`,
  `navigator.geolocation`, `<input type=file>`, CSS `backgroundImage`,
  `transition`, `cursor`, `outlineStyle`, `mixBlendMode`, etc.).
- Branch on `Platform.OS === 'web'` — there's no web platform left.
  (`Platform.OS === 'ios'` is fine — that's iOS vs Android.)
- Re-add the `Platform.OS === 'web'` gate to `KeyboardAvoidingView`'s
  `behavior` prop — keep it as `Platform.OS === 'ios' ? 'padding' : undefined`.

If a previous conversation built web stuff, treat it as a regression
and strip it the way this conversation did (commit `99e3890` and later).

App folder: `helpme/`

- **Package name (permanent):** `com.sabachiburashka.helpme`
- **Versioning:** bump `expo.android.versionCode` in `app.json` for every
  Play Store upload.
- **API base URL:** `https://helpme-jade-tau.vercel.app` (read from
  `Constants.expoConfig.extra.apiBaseUrl` via `components/apiBase.js`).

## GitHub

Remote: https://github.com/sabachiburashka7-source/helpme.git
Branch: main

## Build pipeline — LOCAL Gradle, not EAS

The user has Android Studio + JDK installed locally. We do **not** use
EAS Build or any Expo cloud service. All builds happen on their machine.

- The `android/` folder **is committed to git** (a "prebuild" Android
  project, owned by us). Edits to it persist; do not blindly re-run
  `expo prebuild` — it would overwrite manual native edits. If a config
  change in `app.json` needs to propagate, prefer editing the matching
  native file or running `npx expo prebuild --platform android
  --no-install` and reviewing the diff.
- `/ios` is gitignored; we only ship Android.

### Required environment

- `ANDROID_HOME = C:\Users\gstore\AppData\Local\Android\Sdk` (must be
  exported in build shells; gradle reads it).
- SDK command-line tools at `$ANDROID_HOME/cmdline-tools/latest/bin/`
  (sdkmanager, avdmanager).
- ADB at `$ANDROID_HOME/platform-tools/adb.exe`.
- NDK 27.1.12297006 (install via `sdkmanager "ndk;27.1.12297006"` —
  Gradle's auto-download has historically corrupted the zip; if a build
  fails on NDK install, run sdkmanager manually first).

### Build commands

```bash
# Debug APK — talks to a local Metro server, only useful with `expo run:android`
cd helpme/android
ANDROID_HOME=/c/Users/gstore/AppData/Local/Android/Sdk ./gradlew assembleDebug --no-daemon

# Release APK — bundles JS, runs standalone, what we send to the phone
cd helpme/android
ANDROID_HOME=/c/Users/gstore/AppData/Local/Android/Sdk ./gradlew assembleRelease --no-daemon
```

Output: `helpme/android/app/build/outputs/apk/release/app-release.apk`

The release variant is currently signed with the **debug keystore**
(`android/app/build.gradle` -> `release { signingConfig signingConfigs.debug }`).
Fine for sideloading and internal testing. **Before submitting to Play
Store**, generate a real release keystore and switch the signing config;
once a real keystore is used for an upload, it can never be changed for
that app.

## Installing on the user's phone — REQUIRED workflow

The user's Samsung phone has a **DUAL_APP user profile (user 95)**.
Plain `adb install` installs the APK on every user profile, which creates
a clone in the launcher. Always:

1. **Uninstall first** so no signature/version mismatch dialog.
2. **Install with `--user 0`** so the DUAL_APP profile stays clean.

```bash
ADB=/c/Users/gstore/AppData/Local/Android/Sdk/platform-tools/adb.exe
"$ADB" uninstall com.sabachiburashka.helpme   # ok if "DELETE_FAILED_INTERNAL_ERROR" — that just means not installed
"$ADB" install --user 0 helpme/android/app/build/outputs/apk/release/app-release.apk
cp helpme/android/app/build/outputs/apk/release/app-release.apk /c/Users/gstore/Desktop/helpme-release.apk
```

If a clone reappears, also run:
```bash
"$ADB" uninstall --user 95 com.sabachiburashka.helpme
```

## Architecture — native modules (use these, don't reinvent)

| File | What it does |
|---|---|
| `components/storage.js` | AsyncStorage wrapper. `getItem/setItem/removeItem`. |
| `components/apiBase.js` | `apiUrl('/api/...')` -> absolute Vercel URL. Always use this; never bare relative `/api/...`. |
| `components/location.js` | `getCurrentLocation()` via `expo-location`. |
| `components/profileImage.js` | `pickProfileImage` / `pickOfferImages` via `expo-image-picker`, returning data URLs. |
| `components/MapPicker.js` | MapLibre map inside `react-native-webview`. Used for both picking (draggable) and detail view (`draggable={false}`). No Google Maps API key needed — tiles from openfreemap. |
| `components/BgImage.js` | `<View>` with a background image. Wraps `<Image>` absolutely under children. Use this anywhere you'd reach for CSS `backgroundImage`. |

## Critical native pitfalls

### 1. `newArchEnabled: true` crashes with `PlatformConstants` invariant
We set **`newArchEnabled: false`** in both `app.json` and
`android/gradle.properties`. The New Architecture (Fabric/TurboModules)
has registry issues with this Expo SDK + module mix and crashes at
startup with `TurboModuleRegistry.getEnforcing(...): 'PlatformConstants'
could not be found`. Do not flip this back to true without verifying.

### 2. Edge-to-edge means safe areas are required
`app.json` has `android.edgeToEdgeEnabled: true` (Play Store requires
this). Every screen MUST handle insets:

- `App.js` wraps the tree in `<SafeAreaProvider>` from
  `react-native-safe-area-context` and renders `<StatusBar style="dark" />`
  from `expo-status-bar`.
- `AuthScreen` and `MyRequestsScreen` wrap their root in
  `<SafeAreaView edges={['top', ...]}>`.
- `BrowseScreen` uses `useSafeAreaInsets()` and applies `insets.top` to
  its floating header AND the ScrollView's `paddingTop`.
- The bottom tab bar has NO fixed `height` — let
  `@react-navigation/bottom-tabs` add the gesture-bar inset itself.

If a new screen hides behind the status bar or gesture bar, this is the
cause.

### 3. Release-build crashes need ADB logcat, not Metro
Release APKs don't have a Metro server. When the user reports a crash:

```bash
"$ADB" logcat -c                                          # clear buffer
"$ADB" logcat -v threadtime > /tmp/helpme-crash.log &     # capture
# user reproduces the crash, then:
grep -iE "ReactNativeJS|AndroidRuntime.*FATAL|sabachiburashka" /tmp/helpme-crash.log
```

The actual JS error appears as `E ReactNativeJS:` — that's the needle in
the haystack.

### 4. WebView in release build needs explicit flags
`components/MapPicker.js` sets `mixedContentMode="always"`,
`baseUrl: 'https://localhost'`, `originWhitelist={['*']}`,
`javaScriptEnabled`, `domStorageEnabled`. Removing any of these may
break the map silently. The HTML catches `window.onerror` and posts
errors back via `ReactNativeWebView.postMessage` so the React side can
show an overlay. Preserve this debugging.

## Vercel backend (API only)

- Project: `helpme` (team: `lepton-projects3`).
- Production URL: `https://helpme-jade-tau.vercel.app`.
- API functions: `api/auth.js`, `api/offers.js`, `api/generate-image.js`,
  `api/delete-account.js`, `api/privacy.js` (HTML privacy policy served at
  `/privacy` — this URL goes in the Play Console listing).
- `vercel.json` routes `/api/*` plus `/privacy` and `/delete-account` — no
  general static content is served.
- Auto-deploys on push to main.

### Environment variables (Vercel -> Project Settings -> Environment Variables)

- `OPENAI_API_KEY` — required by `/api/generate-image` for auto-illustrations.
  Without it, requests get a category placeholder.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — required by `/api/auth` and
  `/api/offers`.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` —
  required by `/api/auth` for SMS OTP signup/login via Twilio Verify.
  Verify Service SID starts with `VA`. Georgia must be enabled at
  console.twilio.com -> Verify -> Settings -> Geo Permissions.

## Rules

- **Do NOT take preview screenshots or start dev servers to verify UI
  changes.** Trust the code edits. Starting a preview server wastes
  credits and is forbidden.
- **Do NOT use EAS Build, `eas` CLI, or any Expo cloud service.** All
  builds are local Gradle.
- **Do NOT re-introduce web support.** See the top of this file.
- **Always commit and push after code changes.** Never ask permission —
  just do it. Use `git add . && git commit && git push` from inside
  `helpme/`. Concise commit message.
- **After building a new APK, reinstall it on the phone**: uninstall
  first, then `adb install --user 0`. Update the desktop copy.
- **When the user reports a crash or visible bug, pull `adb logcat`
  first** — don't guess. The phone is usually USB-connected.

## Path to Play Store

| Step | Status |
|---|---|
| Replace web-only APIs with native helpers | Done |
| `app.json` Android config (package, versionCode, scheme, permissions) | Done |
| `android/` folder committed | Done |
| Local release-APK build works | Done |
| App launches without crashing on phone | Done |
| Images render | Done |
| Map renders (both picker and details view) | Done |
| Safe area / sizing correct | Done |
| Web client removed | Done |
| Rebrand to "Kheli" (name, icon, splash, adaptive icon) | Done |
| Generate real release keystore + reconfigure `signingConfigs.release` | Done (`android/app/helpme-release.keystore`, loaded via `android/keystore.properties`, both gitignored) |
| Build production AAB (`./gradlew bundleRelease`) | Done (`android/app/build/outputs/bundle/release/app-release.aab`) |
| Privacy Policy URL hosted | Done (https://helpme-jade-tau.vercel.app/privacy via `api/privacy.js`) |
| In-app account deletion | Done (`/api/delete-account` + Profile screen) |
| Subscription quota (3 free posts/month, Pro UI hidden for v1) | Done |
| **Back up keystore + `keystore.properties` off-machine** | **TODO (user task — if lost, app can never be updated on Play Store)** |
| Bump `expo.android.versionCode` (and matching value in `android/app/build.gradle`) before every upload after the first | Ongoing |
| Play Console account + app listing (title, descriptions, screenshots, feature graphic, content rating, data safety form, privacy URL) | TODO (user task) |
| Closed testing track — 12+ testers, 14 continuous days, before production rollout | TODO (user task) |

## Common debug recipes

```bash
ADB=/c/Users/gstore/AppData/Local/Android/Sdk/platform-tools/adb.exe

# Verify phone is connected
"$ADB" devices

# See which users have the app
"$ADB" shell pm list packages --user 0 | grep helpme
"$ADB" shell pm list packages --user 95 | grep helpme

# Tail app logs in real time (run while reproducing)
"$ADB" logcat -v threadtime ReactNativeJS:* AndroidRuntime:E *:S

# Force-stop the app
"$ADB" shell am force-stop com.sabachiburashka.helpme

# Clear app data (logs you out, clears AsyncStorage)
"$ADB" shell pm clear com.sabachiburashka.helpme
```
