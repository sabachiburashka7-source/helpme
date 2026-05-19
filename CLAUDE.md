# helpme — Project Guide

## What this project is now

**A native Android app** (Expo SDK 54 + React Native 0.81 + Hermes) being
prepared for Google Play Store. The Vercel deployment still exists as a
**backend** — it serves the `/api/*` routes — but the **web front-end is
no longer the deliverable.** Treat web as legacy: do not add new web-only
code paths. The user will not maintain a web client going forward.

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
  change in `app.json` needs to propagate, prefer manually editing the
  matching native file or running `npx expo prebuild --platform android
  --no-install` and reviewing the diff.
- `/ios` is gitignored; we only ship Android.

### Required environment

- `ANDROID_HOME = C:\Users\gstore\AppData\Local\Android\Sdk` (must be
  exported in build shells; gradle reads it).
- SDK command-line tools at `$ANDROID_HOME/cmdline-tools/latest/bin/`
  (sdkmanager, avdmanager).
- ADB at `$ANDROID_HOME/platform-tools/adb.exe`.
- NDK 27.1.12297006 (installed via `sdkmanager "ndk;27.1.12297006"` —
  Gradle's auto-download has historically corrupted the zip; if a build
  ever fails on NDK install, run sdkmanager manually first).

### Build commands

```bash
# Debug APK (talks to a local Metro server — only useful with `expo run:android`)
cd helpme/android
ANDROID_HOME=/c/Users/gstore/AppData/Local/Android/Sdk ./gradlew assembleDebug --no-daemon

# Release APK (bundles JS, runs standalone — what we send to the phone)
cd helpme/android
ANDROID_HOME=/c/Users/gstore/AppData/Local/Android/Sdk ./gradlew assembleRelease --no-daemon
```

Output: `helpme/android/app/build/outputs/apk/release/app-release.apk`

The release variant is currently signed with the **debug keystore** (see
`android/app/build.gradle` — `release { signingConfig signingConfigs.debug }`).
This is fine for sideloading and internal testing. **Before submitting to
Play Store**, generate a real release keystore and switch the signing
config; once a real keystore is used for an upload, it can never be
changed for that app.

## Installing on the user's phone — REQUIRED workflow

The user's Samsung phone has a **`DUAL_APP` user profile (user 95)**.
Plain `adb install` installs the APK on every user profile, which creates
a clone app in the launcher. Always:

1. **Uninstall first** so we never hit a signature/version-mismatch dialog.
2. **Install with `--user 0`** so the DUAL_APP profile stays clean.

```bash
ADB=/c/Users/gstore/AppData/Local/Android/Sdk/platform-tools/adb.exe
"$ADB" uninstall com.sabachiburashka.helpme            # ok if it fails: "DELETE_FAILED_INTERNAL_ERROR" just means already gone
"$ADB" install --user 0 helpme/android/app/build/outputs/apk/release/app-release.apk
cp helpme/android/app/build/outputs/apk/release/app-release.apk /c/Users/gstore/Desktop/helpme-release.apk
```

If the user ever reports a clone reappearing, also run:
```bash
"$ADB" uninstall --user 95 com.sabachiburashka.helpme
```

## Architecture — cross-platform helpers (use these, don't reinvent)

Every API that exists on web but not on native has a Platform-aware
wrapper. **Always import from these — never call browser APIs directly.**

| File | What it wraps | Web behavior | Native behavior |
|---|---|---|---|
| `components/storage.js` | `getItem/setItem/removeItem` | `localStorage` (sync) | `AsyncStorage` |
| `components/apiBase.js` | `apiUrl(path)` | returns path as-is (relative) | prepends `extra.apiBaseUrl` |
| `components/location.js` | `getCurrentLocation()` | `navigator.geolocation` | `expo-location` |
| `components/profileImage.js` | `pickProfileImage`, `pickOfferImages` | `<input type=file>` + canvas | `expo-image-picker` returning data URLs |
| `components/MapPicker.js` | Map render + pin drag | MapLibre injected into DOM | MapLibre inside `react-native-webview` |
| `components/BgImage.js` | `<View>` with background image | uses `Image` underneath (also works on web) | uses `Image` underneath |

All API calls **must** go through `apiUrl('/api/...')` — never use bare
relative paths like `fetch('/api/offers')`. On native there is no
origin to resolve them against.

## Critical native pitfalls (each one bit us in production)

These are things that "look fine" on web but break silently on Android.
Watch for them in any new code.

### 1. CSS `backgroundImage` is web-only — silently ignored on native
RN's `<View>` does not support `backgroundImage`. **Use `<BgImage source={...}>`**
from `components/BgImage.js` for any background-image style. The user has
already seen this break — every `backgroundImage: url(...)` got replaced.

### 2. `Platform.OS === 'web'` early-returns hide entire UI on native
Search for `if (Platform.OS !== 'web') return null` patterns when adding
features — those branches need a native implementation or the feature is
invisible on the phone. (Example: `OfferMap` in `BrowseScreen.js` was
returning null on native and showing nothing where the map should be.)

### 3. `newArchEnabled: true` crashes with `PlatformConstants` invariant
We set **`newArchEnabled: false`** in both `app.json` and
`android/gradle.properties`. The New Architecture (Fabric/TurboModules)
has registry issues with this Expo SDK + module mix and crashes at
startup with `TurboModuleRegistry.getEnforcing(...): 'PlatformConstants'
could not be found`. Do not flip this back to true without verifying.

### 4. Edge-to-edge means safe areas are required
`app.json` has `android.edgeToEdgeEnabled: true` (Play Store requires
this for new uploads). Every screen MUST handle insets:

- `App.js` wraps the tree in `<SafeAreaProvider>` from
  `react-native-safe-area-context` and renders `<StatusBar style="dark" />`
  from `expo-status-bar`.
- `AuthScreen` and `MyRequestsScreen` wrap their root in `<SafeAreaView
  edges={['top', ...]}>`.
- `BrowseScreen` uses `useSafeAreaInsets()` and applies `insets.top` to
  its floating header AND the ScrollView's `paddingTop`.
- The bottom tab bar has NO fixed `height` — let `@react-navigation/bottom-tabs`
  add the gesture-bar inset itself.

If a new screen looks like it's hiding behind the status bar or gesture
bar, missing safe-area handling is the cause.

### 5. Release-build crashes need ADB logcat, not Metro
Release APKs don't have a Metro server. When the user reports a crash,
get logcat:

```bash
"$ADB" logcat -c                                      # clear buffer
"$ADB" logcat -v threadtime > /tmp/helpme-crash.log & # capture
# user reproduces the crash, then:
grep -iE "ReactNativeJS|AndroidRuntime.*FATAL|sabachiburashka" /tmp/helpme-crash.log
```

The actual JS error usually appears as `E ReactNativeJS:` — that's the
needle in the haystack.

### 6. WebView in release build needs explicit flags
`components/MapPicker.js` (native branch) sets `mixedContentMode="always"`,
`baseUrl: 'https://localhost'`, `originWhitelist={['*']}`,
`javaScriptEnabled`, `domStorageEnabled`. Removing any of these may break
the map silently. The WebView HTML also catches `window.onerror` and posts
errors back via `ReactNativeWebView.postMessage` so the React side can show
an overlay. Preserve this debugging.

## Vercel backend (still active — only the API)

- Project: `helpme` (team: `lepton-projects3`).
- Production URL: `https://helpme-jade-tau.vercel.app`.
- The `dist/` folder is still committed and Vercel still serves it as a
  static web build, but we are no longer iterating on the web client.
  Don't gate native work on web bundle rebuilds.
- API functions: `api/auth.js`, `api/offers.js`, `api/generate-image.js`.
- Auto-deploys on push to main.

### Environment variables (Vercel → Project Settings → Environment Variables)

- `OPENAI_API_KEY` — required by `/api/generate-image` for auto-illustrations.
  Without it, requests get a category placeholder.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — required by `/api/auth` and
  `/api/offers` (users table, offers table).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` —
  required by `/api/auth` for SMS OTP signup/login via Twilio Verify.
  Verify Service SID starts with `VA`. Georgia must be enabled at
  console.twilio.com → Verify → Settings → Geo Permissions.

## Rules

- **Do NOT take preview screenshots or start dev servers to verify UI
  changes.** Trust the code edits. Starting a preview server wastes
  credits and is forbidden.
- **Do NOT use EAS Build, `eas` CLI, or any Expo cloud service.** All
  builds are local Gradle. Do not ask the user to log into Expo.
- **Always commit and push after code changes.** Never ask permission —
  just do it. Run `npm run build` first if any file under `helpme/`
  (other than `dist/` and `android/`) was touched, then `git add . && git
  commit && git push` from the repo root. Concise commit message.
- **After building a new APK, reinstall it on the phone**: uninstall
  first, then `adb install --user 0`. Never assume the user will
  transfer the APK manually unless they specifically ask for the file.
- **Stop using web-only browser APIs in new code.** No direct
  `window`, `document`, `navigator.geolocation`, `localStorage`,
  `<input type=file>`, CSS `backgroundImage`, etc. Use the platform-aware
  helpers in `components/`.
- **When the user reports a crash or visible bug, pull `adb logcat`
  first** — don't guess. The phone is usually USB-connected.

## Path to Play Store (where we are)

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
| Generate real release keystore + reconfigure `signingConfigs.release` | **TODO** |
| Build production AAB (`./gradlew bundleRelease`) | **TODO** |
| Privacy Policy URL hosted | TODO (user task) |
| Play Console account + listing | TODO (user task) |
| Closed testing (14 days, 12+ testers) | TODO (user task) |

## Common debug recipes

```bash
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
