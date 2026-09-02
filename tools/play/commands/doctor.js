'use strict';

const fs = require('fs');
const { config, googleAuth, readKey, client, resolvePath, translate, PlayError } = require('../lib/client');
const f = require('../lib/format');

/**
 * Walks the whole chain — key file, sign-in, app access, local build — and
 * stops at the first broken link with an instruction for fixing it.
 */
async function doctor() {
  let key;
  try {
    key = readKey();
  } catch (err) {
    console.log(f.fail('Key file'));
    throw err;
  }
  console.log(f.ok('Key file found'));
  console.log(
    f.pairs([
      ['robot account', key.client_email],
      ['cloud project', key.project_id],
    ])
  );

  try {
    const auth = googleAuth();
    const authed = await auth.getClient();
    const token = await authed.getAccessToken();
    if (!token || !token.token) throw new Error('Google returned no access token.');
  } catch (err) {
    console.log(f.fail('Sign in to Google'));
    throw translate(err);
  }
  console.log(f.ok('Signed in to Google'));

  const ap = client();
  let editId;
  try {
    const { data } = await ap.edits.insert({ packageName: config.packageName });
    editId = data.id;
  } catch (err) {
    console.log(f.fail(`Access to ${config.packageName}`));
    const wrapped = translate(err);
    if (wrapped.message.startsWith('The robot account is not allowed')) {
      throw new PlayError(
        'The robot account cannot reach this app yet.',
        `Invite ${key.client_email} in Play Console under Users and permissions, ` +
          'grant it access to this app, and give it "Release apps to testing tracks", ' +
          '"Manage production releases" and "Edit store listing and pricing".',
        err
      );
    }
    throw wrapped;
  }
  console.log(f.ok(`Can edit ${config.packageName}`));

  let tracks = [];
  try {
    const { data } = await ap.edits.tracks.list({ packageName: config.packageName, editId });
    tracks = data.tracks || [];
  } catch {
    // Not fatal — a brand new app can have no tracks at all.
  } finally {
    try {
      await ap.edits.delete({ packageName: config.packageName, editId });
    } catch {
      /* the edit expires on its own */
    }
  }

  if (tracks.length) {
    const live = tracks
      .filter((t) => (t.releases || []).length)
      .map((t) => t.track)
      .join(', ');
    console.log(f.ok(`Tracks visible: ${tracks.map((t) => t.track).join(', ')}`));
    console.log(f.pairs([['with a release', live || 'none yet']]));
  } else {
    console.log(f.warn('No tracks yet — nothing has been uploaded to this app.'));
  }

  const aab = resolvePath(config.aabPath);
  if (fs.existsSync(aab)) {
    console.log(f.ok(`Local build ready (${f.bytes(fs.statSync(aab).size)})`));
  } else {
    console.log(f.warn('No release bundle built yet.'));
  }

  console.log(`\n${f.green('Everything is connected.')} Play Console access is working.`);
}

module.exports = doctor;
