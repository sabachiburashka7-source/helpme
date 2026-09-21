# helpme — Project Guide

> **This file exists in two places and they must stay identical:**
> `1$/CLAUDE.md` (loads automatically, sits beside the app folder) and
> `helpme/CLAUDE.md` (travels with the git repo). They drifted apart once
> already. Edit one, copy it over the other, commit both.

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

**Cloudflare is the only host.** The owner confirmed on 2026-09-02 that
everything now runs on Cloudflare. Do NOT:

- Restore Vercel in any form — `vercel.json`, the handlers in
  `helpme/api/`, `@vercel/*` packages, or a Vercel deploy step.
- Restore Supabase in any form — clients, keys, or `helpme/supabase/`.
- Reach for Render, Netlify, Heroku, Railway or Fly.io. The backend has
  never been on any of them.

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
| `components/moderation.js` | `REPORT_REASONS` — the report reason keys. Must stay in sync with the `REPORT_REASONS` set in `cloudflare/src/index.js`, which 400s on anything else. |
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
| `BlurSurface` | Fixed chrome — the tab bar and the Browse header. Despite the name it does **not** blur any more (expo-blur crashes on attach); it is an opaque `chrome`-tone pane. |
| `GlassButton` / `GlassIconButton` | Buttons. `primary` = solid accent with a light sheen; also `glass`, `ghost`, `danger`. |
| `GlassField` | Labelled text input with a focus ring. |
| `GlassSegmented` | Pill tab switcher with a sliding glass thumb. |
| `GlassChip` | Small pill — radius filters, "Profile", "Re-detect". |

### Rules

- **Never mount a `BlurView` at all.** See "NO NATIVE BLUR" under
  critical native pitfalls — it crashes the app on launch. `GlassSurface`
  is the no-blur surface and looks nearly identical over the ambient
  background.
- **Body text over a photo needs `tone="read"` + `<PhotoScrim />`.**
  `strong` (62% white) is NOT enough over an AI-generated illustration,
  which can be dark, busy, or high-contrast. The pattern is: `PhotoScrim`
  as a child of the `BgImage` (washes the foot of the picture to near
  white), then a `GlassSurface tone="read"` (72% white) laid over it. The
  photo still ghosts through at ~17%, so it still reads as glass, but
  text lands at 13:1 contrast even over a black image. Do not downgrade
  those cards back to `strong` or to a blurred panel.
- **Don't use `colors.textTertiary` for anything on a glass panel over a
  photo** — use `textSecondary`. `textTertiary` is a caption grey for
  panels over the ambient background only.
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

### 0. NO NATIVE BLUR — `expo-blur` crashes the app on launch

`expo-blur` 15.0.8's `ExpoBlurView.onAttachedToWindow` calls
`configureBlurView()`, which dereferences `appContext.throwingActivity`
with **no null check**. When that reference is unavailable on attach, the
module throws `MissingActivity` on the main thread and the process dies
before drawing a frame. Reproduced 3/3 on a cold start on the user's
Galaxy S24 Ultra (Android 16), found in v1.0.2 and fixed in `6d20336`.

The throw happens on *attach*, before any blur prop is read, so
`experimentalBlurMethod`, `intensity` and `blurReductionFactor` cannot
avoid it. **The view simply must not be mounted.**

- `BlurSurface` and `GlassPanel` no longer render a `BlurView`. They keep
  accepting `blur` / `intensity` props and ignore them, so old call sites
  stay valid.
- Fixed chrome (tab bar, Browse header) uses the `chrome` tone
  (`glass.fillChrome`, 88% white). With no blur, that fill is the only
  thing stopping cards scrolling underneath from reading through the bar
  — do not thin it out.
- Before ever reintroducing blur: upgrade `expo-blur`, then confirm
  `configureBlurView` guards the activity, then cold-start on a real
  device.

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

### Hosting history — read this before "fixing" the host

The backend has only ever lived in two places:

| When | Host | Address |
|---|---|---|
| Now | **Cloudflare Workers + D1 + KV** | `https://helpme-api.semolina.workers.dev` |
| Before 2026-08-31 | Vercel + Supabase (dead) | `https://helpme-jade-tau.vercel.app` |

It has **never** been on Render, Netlify, Heroku, Railway or Fly.io. If a
conversation refers to "the old host", that means **Vercel** — Render is a
misremembering and there is no Render config anywhere in this repo.

Dead weight still on disk from the Vercel era, kept only as a rollback
reference: `helpme/vercel.json` and the six handlers in `helpme/api/`.
Nothing deploys them. They are the likeliest source of confusion about
which host is live — delete them once the Cloudflare setup has been
stable through a Play Store release.

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
- **D1 database** `helpme-db` (region EEUR), binding `DB`. Tables `users`,
  `offers`, `reports` and `blocks`. Replaces Supabase Postgres.
- **KV namespace** `IMAGES`, binding `IMAGES`. Holds the generated PNGs
  and replaces Supabase Storage; they are served back by the Worker at
  `/api/image/<offer-id>.png`, so the app still just stores a URL string.
- Routes: `/api/auth`, `/api/offers`, `/api/update-offer`,
  `/api/generate-image`, `/api/image/<id>.png`, `/api/report`,
  `/api/blocks`, `/privacy`, `/delete-account`, and `/health`
  (liveness probe).
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


### Moderation — reports and blocks (shipped 2026-09-18, build 12)

Google Play's User Generated Content policy expects an app whose content is
mostly user-posted to offer a way to flag a listing and block its author.
Both are keyed on **`phone`** — the identity the rest of the API already
uses (quota counting, `delete_account`, `offers.phone`). There is no user id
on `offers` to join against, so do not switch these to `users.id`.

- `POST /api/report` — `{ offer_id, reporter_phone, reason, details? }`.
  `reason` must be one of the `REPORT_REASONS` set in `src/index.js`, which
  mirrors `components/moderation.js`; anything else is a 400. Reporting your
  own offer is a 400, a missing offer is a 404. Returns
  `{ ok, reports, hidden }`.
- `GET|POST|DELETE /api/blocks` — list, block, unblock. POST accepts either
  `blocked_phone` or an `offer_id` to resolve the owner from, because the app
  only knows the listing. GET returns `[{ phone, name, created_at }]`, where
  `name` falls back from the account to their most recent offer.

**`GET /api/offers` now takes `?phone=<viewer>`** and filters four ways in one
statement: drops authors the viewer blocked, drops offers the viewer already
reported, drops offers past `REPORT_HIDE_THRESHOLD` (3 **distinct** reporters)
for everyone else, and always keeps the viewer's own posts so a request never
silently vanishes from "My requests". Those carry `hidden: true` so the owner
gets told why. Old clients omit `?phone=` and simply skip the block filter —
threshold hiding still applies to them.

The unique index on `reports (offer_id, reporter_phone)` is what makes
"distinct" true, so the auto-hide count is a plain `COUNT(*)`. Re-reporting
upserts the reason instead of adding a second vote. Do not drop that index.

There is still **no moderator queue** — nothing surfaces reports for a human
to act on. Auto-hide at three reporters is the whole enforcement mechanism.
Read what has come in with:

```bash
cd helpme/cloudflare
npx wrangler d1 execute helpme-db --remote --command="SELECT offer_id, reason, COUNT(*) n FROM reports GROUP BY offer_id, reason ORDER BY n DESC;"
```

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

  **These two values ARE the credentials in Play Console -> App content ->
  Sign in details. They are one fact stored in two systems, and they drifted
  apart once — that cost a rejection (see below). `TEST_PHONE` must be the
  full E.164 number including the `+` and the country code; the comparison in
  `handleAuth` is an exact string match, so `995555000001` does NOT match an
  inbound `+995555000001` and the bypass silently never fires.** The declared
  phone is `+995555000001`; the 6-digit code lives only in Play Console, never
  in this public repo.

  Secret values cannot be read back, so **never assume** the bypass works —
  prove it against the live Worker before every submission. This is the whole
  check, and it sends no SMS:

```bash
# 1. must answer {"status":"sent"}  2. must answer a user object, not an error
curl -s -X POST https://helpme-api.semolina.workers.dev/api/auth   -H "Content-Type: application/json"   -d '{"action":"send_code","intent":"login","phone":"+995555000001"}'
curl -s -X POST https://helpme-api.semolina.workers.dev/api/auth   -H "Content-Type: application/json"   -d '{"action":"verify_code","intent":"login","phone":"+995555000001","code":"<code from Play Console>"}'
```

  `{"error":"No account found for this number"}` from the first call is the
  signature of a mismatch: the Worker did not recognise the number as the test
  phone at all, so it fell through to the ordinary login path.

### Rejected 2026-09-19: "Login credentials are incorrect"

Build 11 was rejected because the reviewer could not sign in — their
screenshot showed `No account found for this number` after entering
`555000001`. Play Console declared `+995555000001`, but the Worker's
`TEST_PHONE` secret held something else, so the bypass never fired and the
login fell through to a real account lookup that found nothing.

Fixed 2026-09-20 by setting `TEST_PHONE` / `TEST_OTP` on the Worker to exactly
the declared values and verifying with the two calls above. Nothing in the
Play Console declaration needed changing — the instructions there were already
correct and specific. Re-submitted for review the same day.

### Production data wiped 2026-09-21 (clean slate for the public launch)

The owner reported the app live on the Play Store on 2026-09-21 and asked for
every old post and account to go. Deleted from the live backend, no app update
needed: all rows in `users` (3), `offers` (24), `reports` (0) and `blocks` (0),
plus all 22 PNGs in the `IMAGES` KV. All of it was dev / closed-testing data —
the newest account was the `TEST_PHONE` reviewer one, and no post was newer
than 2026-09-16. An empty database is therefore the expected state, not a bug.

**Backup** lives outside the git repo in `1$/backups/2026-09-21-before-wipe/`:
`helpme-db.sql` (full `d1 export`), `images/<offer-id>.png` with
`image-keys.json`, and `restore-point.json` — the D1 Time Travel bookmark
`000000eb-00000000-000050ed-bf440669fc72c17e2cc8b6a65e92c971`. It holds real
phone numbers: never copy it into `helpme/`, which is a public repo.

To undo, either:

- `npx wrangler d1 time-travel restore helpme-db --bookmark=<bookmark above>` —
  only inside the Time Travel window (7 days on the Workers Free plan, 30 on
  Paid), and it rolls back **everything** written since, real sign-ups included.
- Or run only the `INSERT` statements from `helpme-db.sql` with
  `d1 execute --remote --file=...` — the file opens each table with a plain
  `CREATE TABLE`, which fails against the live tables, so strip those and the
  `CREATE INDEX` lines first. Put the pictures back with
  `npx wrangler kv key put <offer-id> --path=images/<offer-id>.png --namespace-id=9a78980872ea41298fd569860863b9b0 --remote`.

**Phones signed in before the wipe stay signed in.** `App.js` ignores a 404
from `action: 'me'`, so the cached user survives with no `users` row behind it.
Browsing and posting still work (`POST /api/offers` needs no `users` row; a
missing row counts as free tier), but changing the profile photo fails with
"User not found". Fix for a person: Profile -> Sign out -> Register again. The
`TEST_PHONE` account rebuilds itself on the next reviewer sign-in, because the
`verify_code` bypass creates the row when it is missing.

### Debugging the backend

```bash
cd helpme/cloudflare
npx wrangler tail                                   # live logs
npx wrangler d1 execute helpme-db --remote --command="SELECT COUNT(*) FROM offers;"
```

`helpme/api/`, `helpme/supabase/` and `helpme/vercel.json` are dead code
from the pre-Cloudflare era. Nothing deploys them and nothing imports
them. The owner has confirmed Cloudflare-only hosting, so they are safe
to delete — they survive purely because nobody has pulled the trigger.
Do not "fix" or update anything inside them.

## Play Console automation (`tools/play/`)

Play Console hides these pages behind a search box that often fails to find
them. The developer account id is **5763895807300578547** (not secret — it is
in the URL of every console page), so link straight to them instead:

| Page | Link |
|---|---|
| API access / service accounts | `https://play.google.com/console/u/0/developers/5763895807300578547/api-access` |
| Users and permissions | `https://play.google.com/console/u/0/developers/5763895807300578547/users-and-permissions` |
| All apps | `https://play.google.com/console/u/0/developers/5763895807300578547/app-list` |

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
the developer account, identity checks or payments.

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
| Play Console developer account + app entry created | Done (owner confirmed 2026-09-02) |
| Play Console API access for Claude (`tools/play/`) | Done — key installed, `node play.js doctor` passes as of 2026-09-12 |
| Store listing content (title, descriptions, screenshots, feature graphic) | Done — verified live on 2026-09-12: title, both descriptions, icon, feature graphic, 3 phone screenshots |
| Closed testing track — 12+ testers, 14 continuous days | Done — 18 testers; all three Google criteria show complete as of 2026-09-12 |
| Content rating questionnaire | Done — submitted 2026-09-18, 6:43 PM. App content now reads "You're all caught up." |
| Data safety form, app access declarations | Done |
| **Production access granted by Google** | **GRANTED — confirmed on the dashboard 2026-09-18. Applied 2026-09-12; first application was REJECTED 2026-08-25.** |
| Production country targeting | Done — Georgia only, set 2026-09-18. Console-only; the API cannot set countries for a `completed` release. |
| **Production release submitted** | **REJECTED 2026-09-19 — "Login credentials are incorrect"; the reviewer could not sign in. Cause and fix recorded under the Cloudflare secrets section. Re-submitted 2026-09-20. Owner reported it live on the Play Store 2026-09-21.** |
| Wipe test data before the public launch | Done 2026-09-21 — every account, post and picture deleted; backup and undo steps under "Production data wiped" in the Cloudflare section |
| Report content + block user (Google Play UGC policy) | Done — build 12, 2026-09-18. Worker deployed, D1 tables live. |
| **Re-submit the content rating questionnaire answering Yes to block/report** | **TODO once build 12 is live — should lower the 12+ rating.** |

### Production access: granted 2026-09-18, after one rejection

**Granted.** The Play Console dashboard confirms: "Congratulations! Your
app has been granted Google Play production access." Verified against the
live API the same day — `production` and `beta` now accept releases that
previously returned `FAILED_PRECONDITION`. Nothing here is blocked any
more; leave this section as history only.

**History.** The first application was rejected on **2026-08-25, 11:41 AM**:
"We reviewed your application, and determined that your app requires more
testing before you can access production." The cause was visible in the
saved answers: the three *closed test* questions were 53, 131 and 126
characters out of 300 and said nothing concrete. The *app* questions were
specific — that half was fine. Separately, the Supabase free project
auto-paused mid-test and took the backend offline, silently failing an
earlier 14-day test; moving to Cloudflare on 2026-08-31 fixed that.

**Second application, submitted 2026-09-12 at 1:58 PM, granted by
2026-09-18.** Rewrote the three closed-test answers, finished a truncated
production-readiness answer, replaced the "what did you do differently"
answer. Facts used: 18 opted-in testers recruited through a **paid testing
provider**; two new builds (10 on 09-02, 11 on 09-06) after the rejection;
launch crash, safe-area text, map and three-post cap all fixed.

Clicking **Apply** surfaced a `(5EF69F45)` "unexpected error" snackbar.
It was a stale UI artifact — the submission had succeeded.

### Going to production: the two console-only steps the API cannot do

Both were done on 2026-09-18 by driving the Play Console in the owner's
Chrome. Neither has an API, and both silently block a production release:

1. **Content rating questionnaire.** Was sitting half-finished from
   2026-06-07 with no IARC certificate. Submitted 2026-09-18, 6:43 PM.
2. **Production country targeting.** A brand-new production track targets
   *no* countries, and `edits.validate` then fails with `PERMISSION_DENIED
   :: Release in track targeting no countries`. Set to **Georgia only**,
   matching Twilio's geo permissions — outside Georgia the SMS sign-in
   cannot deliver a code. Play Console → Production → Countries / regions.

   Do **not** try to fix this through the API: passing `countryTargeting`
   on the release returns `INVALID_ARGUMENT :: Country targeting is only
   supported for staged releases`. It works only for a partial rollout,
   never for a `completed` one.

Useful trick for checking readiness without publishing anything: create an
edit, stage the track, call `edits.validate`, then `edits.delete` the edit.
It surfaces the real blocking error while committing nothing.

### Content rating: Kheli is rated 12+ (USK 16+), and why

Submitted answers: category **All Other App Types**; user-generated content
is the **primary** source of content; app shows online content (listings
plus AI-generated illustrations); precise device location is shared with
other users. Everything else — violence, sexuality, language, drugs,
age-restricted goods, digital purchases, cash/crypto rewards — answered No.

Resulting ratings: Google Play **12+**, ESRB **Teen**, PEGI **Parental
guidance**, USK **16+** ("Increased Communication Risks"), ClassInd **12+**.
Interactive elements on all of them: *Users Interact*, *Shares Location*.

The age band was driven entirely by one combination: UGC is primary **and**
the app had **no block, no report, no moderation**.

**That is no longer true as of build 12 (2026-09-18).** Report and block both
ship now — see "Moderation" under the Cloudflare section. The rating on file
is still the old one, because IARC only re-rates when a new questionnaire is
submitted. Once build 12 is live, go to Play Console -> App content ->
Content ratings -> **Start new questionnaire** and answer **Yes** to "ability
to block users or user-generated content" and **Yes** to "ability to report
users or user-generated content"; chat moderation stays No (there is no chat).
That should pull the age band below 12+ and it closes the UGC-policy gap.

### Release submitted 2026-09-18

Build 11 promoted to production at full rollout, bundled for review with
the country change and the content rating:

```bash
cd helpme/tools/play
node play.js upload --track production --version-code 11 --status completed --confirm   --notes "Kheli is here. Post what you need doing, set your price, and get help from people nearby."
```

Managed publishing is **off**, so once Google approves, the app goes live
by itself — nobody needs to press anything. Watch progress at Play Console
→ Publishing overview. `node play.js status` shows the track contents but
**not** the review state; the console is the only place that shows that.

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
