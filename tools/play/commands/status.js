'use strict';

const fs = require('fs');
const { config, withEdit, resolvePath } = require('../lib/client');
const f = require('../lib/format');

const TRACK_LABELS = {
  internal: 'Internal testing',
  alpha: 'Closed testing',
  beta: 'Open testing',
  production: 'Production',
};

function localVersion() {
  try {
    const appJson = JSON.parse(fs.readFileSync(resolvePath('../../app.json'), 'utf8'));
    const expo = appJson.expo || {};
    return { name: expo.name, version: expo.version, versionCode: expo.android?.versionCode };
  } catch {
    return null;
  }
}

function describeRelease(release) {
  const bits = [`v${(release.versionCodes || []).join(', v')}`];
  if (release.name) bits.push(`"${release.name}"`);
  bits.push(release.status);
  if (release.userFraction) bits.push(`${Math.round(release.userFraction * 100)}% rollout`);
  return bits.join(' · ');
}

async function status() {
  const local = localVersion();
  const aab = resolvePath(config.aabPath);
  const built = fs.existsSync(aab) ? fs.statSync(aab) : null;

  console.log(f.heading('On this computer'));
  console.log(
    f.pairs([
      ['app', local?.name],
      ['version', local ? `${local.version} (build ${local.versionCode})` : 'unknown'],
      ['bundle', built ? `${f.bytes(built.size)}, built ${built.mtime.toLocaleString()}` : 'not built yet'],
    ])
  );

  const { tracks, bundles } = await withEdit(
    async ({ ap, packageName, editId }) => {
      const [t, b] = await Promise.all([
        ap.edits.tracks.list({ packageName, editId }),
        ap.edits.bundles.list({ packageName, editId }).catch(() => ({ data: {} })),
      ]);
      return { tracks: t.data.tracks || [], bundles: b.data.bundles || [] };
    },
    { commit: false }
  );

  console.log(f.heading('On Google Play'));
  if (!tracks.length) {
    console.log('  Nothing published yet.');
  } else {
    for (const track of tracks) {
      const label = TRACK_LABELS[track.track] || track.track;
      const releases = track.releases || [];
      if (!releases.length) {
        console.log(`  ${f.dim(label.padEnd(18))} ${f.dim('empty')}`);
        continue;
      }
      for (const release of releases) {
        console.log(`  ${f.bold(label.padEnd(18))} ${describeRelease(release)}`);
        for (const note of release.releaseNotes || []) {
          const text = note.text.split('\n')[0];
          console.log(`  ${' '.repeat(18)} ${f.dim(`${note.language}: ${text}`)}`);
        }
      }
    }
  }

  if (bundles.length) {
    const codes = bundles.map((b) => b.versionCode).sort((a, b) => a - b);
    console.log(f.heading('Builds uploaded'));
    console.log(f.pairs([['version codes', codes.join(', ')], ['highest', String(codes[codes.length - 1])]]));

    if (local?.versionCode && codes.includes(local.versionCode)) {
      console.log(
        `\n  ${f.yellow('Note:')} build ${local.versionCode} is already on Play. ` +
          'Bump versionCode before the next upload.'
      );
    }
  }
}

module.exports = status;
