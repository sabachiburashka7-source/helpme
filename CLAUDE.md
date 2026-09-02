# helpme — Project Guide

## What this project is

A **native Android app** (Expo SDK 54 + React Native 0.81 + Hermes)
targeting Google Play Store. Cloudflare Workers host the backend API only.

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
- **API base URL:** `https://helpme-api.semolina.workers.dev` (read from
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
| `components/apiBase.js` | `apiUrl('/api/...')` -> absolute Cloudflare Worker URL. Always use this; never bare relative `/api/...`. |
| `components/location.js` | `getCurrentLocation()` via `expo-location`. |
| `components/profileImage.js` | `pickProfileImage` / `pickOfferImages` via `expo-image-picker`, returning data URLs. |
| `components/MapPicker.js` | MapLibre map inside `react-native-webview`. Used for both picking (draggable) and detail view (`draggable={false}`). No Google Maps API key needed — tiles from openfreemap. |
| `components/BgImage.js` | `<View>` with a background image. Wraps `<Image>` absolutely under children. Use this anywhere you'd reach for CSS `backgroundImage`. |
| `components/Glass.js` | Glassmorphism primitives (`AmbientBackground`, `GlassSurface`, `BlurSurface`, `GlassButton`, `GlassField`, `GlassSegmented`, `GlassChip`). See the design system section below. |

## Design system — glassmorphism (`components/Glass.js`)

The whole UI is frosted glass floating over an ambient background. The
**palette is unchanged** — `colors` in `components/theme.js` holds the same
values it always did. `theme.js` now also exports a `glass` token set,
which is just those same colors at low alpha.

| Piece | Use it for |
|---|---|
| `AmbientBackground` | Root of every screen. White -> `bg` -> `accentSoft` gradient plus soft accent orbs. Without it, glass has nothing to show through and just looks grey. |
| `GlassSurface` | The default panel: translucent fill + bright rim + diagonal sheen. **No native blur**, so it is safe inside scrolling lists. Cards, fields, chips, modal sheets. |
| `BlurSurface` | Real `expo-blur` frosted glass. **Fixed chrome only** — the tab bar and the Browse header. |
| `GlassButton` / `GlassIconButton` | Buttons. `primary` = solid accent with a light sheen; also `glass`, `ghost`, `danger`. |
| `GlassField` | Labelled text input with a focus ring. |
| `GlassSegmented` | Pill tab switcher with a sliding glass thumb. |
| `GlassChip` | Small pill — radius filters, "Profile", "Re-detect". |

### Rules

- **Never put a `BlurView` inside a `ScrollView` or a `Modal`.** Android
  blur is the experimental `dimezisBlurView` path: expensive while
  scrolling and it misrenders inside modals. `GlassSurface` is the
  no-blur fallback and looks nearly identical over the ambient background.
- **Don't reintroduce solid `backgroundColor: colors.surface` panels.**
  If a new panel needs a background, use `GlassSurface`.
- **The bottom tab bar is `position: 'absolute'` and fully transparent**
  so content scrolls under the blur. Every screen inside the navigator
  must pad its scroll content with `useBottomTabBarHeight()` from
  `@react-navigation/bottom-tabs`, or content hides behind the bar. It
  still has **no fixed `height`** — bottom-tabs adds the gesture inset.
- **Keep the palette.** Glass means the same colors at lower alpha, never
  new hues.
- **No `elevation` on a translucent, large-radius view.** Android paints a
  fill inset from the edges by the corner radius, which shows up as a
  hard-edged bright rectangle inside the panel. Glass surfaces carry
  `elevation: 0` (see the note in `theme.js`); only opaque things — the
  accent button, image frames — get elevation. Bright rim + translucent
  fill is what makes glass float.
- **Absolute children are inset by the parent's padding in Yoga** (unlike
  CSS). An overlay using `StyleSheet.absoluteFill` inside a padded panel
  covers only the content box. `GlassSurface` therefore paints its sheen
  as its own `LinearGradient` container rather than as an overlay.
- Native deps this relies on: `expo-blur`, `expo-linear-gradient`. Both
  are autolinked; a JS-only change needs no prebuild, but the APK must be
  rebuilt after they were added.

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

## Cloudflare backend (API only)

Migrated off Vercel + Supabase on 2026-08-31. Reason: the Supabase free
project auto-paused after inactivity (its DNS stopped resolving), which
took the whole app down and silently failed a 14-day closed test — and
Vercel's Hobby plan forbids commercial use. Cloudflare's free tier does
neither.

- Worker: `helpme-api` — **https://helpme-api.semolina.workers.dev**
- Source lives in `helpme/cloudflare/`:
  - `src/index.js` — the whole API: one router, all endpoints.
  - `src/privacy.html`, `src/delete-account.html` — served as-is. Pulled
    in via the `Text` rule in `wrangler.jsonc`, so edit them as normal
    HTML (no escaping).
  - `schema.sql` — D1 tables. Safe to re-run (`IF NOT EXISTS`).
  - `wrangler.jsonc` — bindings. Secrets are deliberately NOT here.
- **D1 database** `helpme-db` (region EEUR), binding `DB`. Tables `users`
  and `offers`. Replaces Supabase Postgres.
- **KV namespace** `IMAGES`, binding `IMAGES`. Holds the generated PNGs
  and replaces Supabase Storage; they are served back by the Worker at
  `/api/image/<offer-id>.png`, so the app still just stores a URL string.
- Routes: `/api/auth`, `/api/offers`, `/api/update-offer`,
  `/api/generate-image`, `/api/image/<id>.png`, `/privacy`,
  `/delete-account`, and `/health` (liveness probe).
- **Does NOT auto-deploy on push.** Deploy explicitly:

```bash
cd helpme/cloudflare
npx wrangler deploy
```

### Postgres -> SQLite conversions (already handled in `src/index.js`)

D1 is SQLite, so the API layer converts on the way in and out. Preserve
this or the app will receive the wrong shapes:

- `uuid` -> `TEXT` holding `crypto.randomUUID()`.
- `timestamptz` -> `TEXT` holding an ISO-8601 UTC string.
- `text[]` (`offers.images`) -> `TEXT` holding a JSON array. `shapeOffer()`
  parses it back into a real array before responding.
- No Node built-ins: use `btoa`/`atob`, not `Buffer`. There is no
  `nodejs_compat` flag set.

### Secrets (Cloudflare dashboard -> Workers -> helpme-api -> Settings -> Variables)

Set as **encrypted secrets**, never in `wrangler.jsonc`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` —
  `/api/auth` SMS OTP via Twilio Verify. Verify Service SID starts with
  `VA`. Georgia must be enabled at console.twilio.com -> Verify ->
  Settings -> Geo Permissions.
- `OPENAI_API_KEY` — `/api/generate-image`. **Without it, offers get no
  illustration — and `BrowseScreen.js:136` filters to `o.image`, so an
  offer with no picture never appears in Browse at all.**
- `TEST_PHONE`, `TEST_OTP` — the SMS bypass. When the inbound phone
  equals `TEST_PHONE`, no SMS is sent and the code is checked locally
  against `TEST_OTP`. This is how Play reviewers and paid closed testers
  (who cannot receive a Georgian SMS) sign in. Both must be set for the
  bypass to activate.

### Debugging the backend

```bash
cd helpme/cloudflare
npx wrangler tail                                   # live logs
npx wrangler d1 execute helpme-db --remote --command="SELECT COUNT(*) FROM offers;"
```

The old Vercel handlers are still in `helpme/api/` as a rollback
reference. They are dead code — nothing deploys them.

## Play Console automation (`tools/play/`)

Claude has direct API access to Play Console through a Google Cloud
**service account** — a robot account invited into the console. The CLI
lives in `helpme/tools/play/` and is run by Claude, never by the user.

```bash
cd helpme/tools/play
node play.js doctor                                # verify access end to end
node play.js status                                # tracks vs. local build
node play.js upload --track internal --notes "..."
node play.js listing get|push                      # title + descriptions
node play.js images list|push                      # icon, feature graphic, screenshots
node play.js reviews list|reply
node play.js testers get|set                       # closed-testing Google Groups
```

- **The key is `tools/play/service-account.json`, gitignored twice over.**
  Anyone holding it can publish to the live listing. Never commit it,
  never `cat` it into a transcript, never send it anywhere.
- Publishing to `production` and posting a public review reply both need
  an explicit `--confirm`, on top of asking the user first.
- Every change is staged inside a Play "edit" and only lands on commit.
  Anything thrown abandons the edit, so a half-finished change never
  reaches the live listing.
- `--dry-run` on `upload`, `listing push`, `images push` and `testers set`
  shows what would happen without sending anything.

Google exposes **no API** for these — they stay manual in the console:
creating the app entry, the content rating questionnaire, the data safety
form, app access / ads / target-audience declarations, and anything about
the developer account, identity checks or payments. The very first upload
for a new app generally has to go through the console too.

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
| Privacy Policy URL hosted | Done (https://helpme-api.semolina.workers.dev/privacy via `cloudflare/src/privacy.html`) — **update this URL in the Play Console listing** |
| In-app Privacy Policy link | Done (Profile "Legal" section + Auth consent line, open via native `Linking`) |
| Trim unused sensitive permissions | Done (removed `RECORD_AUDIO`/`SYSTEM_ALERT_WINDOW`; capped legacy storage perms in `AndroidManifest.xml`) |
| In-app account deletion | Done (`/api/delete-account` + Profile screen) |
| Subscription quota (3 free posts/month, Pro UI hidden for v1) | Done |
| **Back up keystore + `keystore.properties` off-machine** | **TODO (user task — if lost, app can never be updated on Play Store)** |
| Bump `expo.android.versionCode` (and matching value in `android/app/build.gradle`) before every upload after the first | Ongoing |
| Play Console API access for Claude (`tools/play/`) | Tool built — waiting on the service-account key from the owner |
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
