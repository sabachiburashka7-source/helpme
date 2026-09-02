'use strict';

const fs = require('fs');
const { config, withEdit, resolvePath, PlayError } = require('../lib/client');
const f = require('../lib/format');

const TRACKS = ['internal', 'alpha', 'beta', 'production'];
const STATUSES = ['draft', 'completed', 'inProgress', 'halted'];
const MAPPING = '../../android/app/build/outputs/mapping/release/mapping.txt';

function appMeta() {
  try {
    const { expo } = JSON.parse(fs.readFileSync(resolvePath('../../app.json'), 'utf8'));
    return { version: expo.version, versionCode: expo.android?.versionCode };
  } catch {
    return {};
  }
}

async function upload(flags) {
  const track = flags.track || 'internal';
  if (!TRACKS.includes(track) && !flags.force) {
    throw new PlayError(
      `Unknown track "${track}".`,
      `Use one of: ${TRACKS.join(', ')}. A custom closed-testing track needs --force.`
    );
  }

  // Publishing to production is public and hard to walk back, so it takes an
  // explicit flag rather than a default.
  const isPublic = track === 'production';
  let status = flags.status || (isPublic ? 'draft' : 'completed');
  if (!STATUSES.includes(status)) {
    throw new PlayError(`Unknown release status "${status}".`, `Use one of: ${STATUSES.join(', ')}.`);
  }
  if (isPublic && status !== 'draft' && !flags.confirm) {
    throw new PlayError(
      'Refusing to publish to production without confirmation.',
      'This would push the app to every user. Re-run with --confirm once the owner has said yes, ' +
        'or leave it as a draft.'
    );
  }

  const rollout = flags.rollout ? Number(flags.rollout) : null;
  if (rollout !== null) {
    if (!(rollout > 0 && rollout < 1)) {
      throw new PlayError('Rollout must be between 0 and 1.', 'For example --rollout 0.1 for 10% of users.');
    }
    status = 'inProgress';
  }

  const bundlePath = resolvePath(flags.file || config.aabPath);
  if (!fs.existsSync(bundlePath)) {
    throw new PlayError(
      'No app bundle to upload.',
      `Expected a release bundle at:\n  ${bundlePath}\n\nBuild one first, then try again.`
    );
  }
  const size = fs.statSync(bundlePath).size;
  const meta = appMeta();

  console.log(f.heading('About to upload'));
  console.log(
    f.pairs([
      ['app', config.packageName],
      ['bundle', `${f.bytes(size)}`],
      ['local version', meta.version ? `${meta.version} (build ${meta.versionCode})` : 'unknown'],
      ['track', track],
      ['release status', status + (rollout ? ` at ${Math.round(rollout * 100)}%` : '')],
    ])
  );

  if (flags['dry-run']) {
    console.log(`\n${f.yellow('Dry run')} — nothing was sent to Google.`);
    return;
  }

  const result = await withEdit(
    async ({ ap, packageName, editId }) => {
      const { data: bundle } = await ap.edits.bundles.upload({
        packageName,
        editId,
        media: { mimeType: 'application/octet-stream', body: fs.createReadStream(bundlePath) },
      });
      const versionCode = bundle.versionCode;
      console.log(f.ok(`Uploaded build ${versionCode}`));

      // Crash reports are unreadable without the mapping file, so send it when
      // the build produced one.
      const mapping = resolvePath(MAPPING);
      if (fs.existsSync(mapping)) {
        try {
          await ap.edits.deobfuscationfiles.upload({
            packageName,
            editId,
            apkVersionCode: versionCode,
            deobfuscationFileType: 'proguard',
            media: { mimeType: 'application/octet-stream', body: fs.createReadStream(mapping) },
          });
          console.log(f.ok('Uploaded the crash-report mapping file'));
        } catch {
          console.log(f.warn('Could not upload the mapping file — crash reports may be hard to read.'));
        }
      }

      const release = {
        versionCodes: [String(versionCode)],
        status,
        name: flags.name || (meta.version ? `${meta.version} (${versionCode})` : String(versionCode)),
      };
      if (rollout) release.userFraction = rollout;

      const notes = flags['notes-file']
        ? fs.readFileSync(resolvePath(flags['notes-file']), 'utf8').trim()
        : flags.notes;
      if (notes) {
        release.releaseNotes = [{ language: flags.language || config.defaultLanguage, text: notes }];
      }

      await ap.edits.tracks.update({ packageName, editId, track, requestBody: { track, releases: [release] } });
      console.log(f.ok(`Put build ${versionCode} on the ${track} track`));
      return { versionCode };
    },
    { changesNotSentForReview: Boolean(flags['stage-only']) }
  );

  console.log(
    `\n${f.green('Done.')} Build ${result.versionCode} is on ${track}` +
      (status === 'draft' ? ' as a draft — it still needs to be rolled out in Play Console.' : '.')
  );
}

module.exports = upload;
