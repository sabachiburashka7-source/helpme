# Play Console tools

Talks to the Google Play Developer API on behalf of **Kheli**
(`com.sabachiburashka.helpme`).

Claude runs this. The owner never types a command.

## The key

Authentication is a Google Cloud **service account** — a robot account invited
into Play Console. Its JSON key lives at `tools/play/service-account.json` and
is gitignored twice over (here and in the repo root `.gitignore`).

Anyone holding that file can publish releases to the live listing. Never
commit it, never paste it into a chat, never send it anywhere.

If it leaks: Google Cloud console -> IAM & Admin -> Service Accounts -> the
account -> Keys -> delete the key, then create a new one.

## Commands

```
node play.js doctor              # is access working, end to end
node play.js status              # what is on each track vs. what is built locally
node play.js upload              # send the release bundle to a track
node play.js listing get|push    # store title and descriptions
node play.js images list|push    # icon, feature graphic, screenshots
node play.js reviews list|reply  # user reviews
node play.js testers get|set     # closed-testing Google Groups
```

Options worth knowing:

- `--dry-run` — show what would happen, send nothing.
- `--confirm` — required to publish to production, and to post a public
  review reply. Only pass it after the owner has actually said yes.
- `--track internal|alpha|beta|production` — `alpha` is closed testing,
  `beta` is open testing. Defaults to `internal`.
- `--status draft|completed|inProgress|halted` — defaults to `completed`
  on test tracks and `draft` on production.
- `--rollout 0.1` — staged rollout to 10%; implies `inProgress`.

Every change is staged in a Play "edit" and only lands on commit. If anything
throws, the edit is abandoned, so a half-finished change never reaches the
live listing.

## What this cannot do

Google exposes no API for these. They have to be done by hand in Play Console:

- Creating the app entry in the first place
- The content rating questionnaire
- The data safety form
- App access, ads and target-audience declarations
- Anything about the developer account, identity checks or payments

The first upload for a brand new app generally has to go through the console
too. After that, `upload` takes over.

## Files

- `config.json` — package name, where the bundle is, default language.
- `listing/<lang>.json` — store text. `listing get` writes it, `listing push`
  sends it. A `_draft` key blocks pushing until it is removed.
- `store/<lang>/` — `icon.png`, `featureGraphic.png`, and a
  `phoneScreenshots/` folder. `images push` replaces each type wholesale, so
  re-running is safe.
