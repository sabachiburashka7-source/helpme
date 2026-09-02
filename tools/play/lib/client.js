'use strict';

const fs = require('fs');
const path = require('path');
const { androidpublisher, auth: gauth } = require('@googleapis/androidpublisher');

const ROOT = path.resolve(__dirname, '..');
const config = require(path.join(ROOT, 'config.json'));

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/**
 * An error we already understand well enough to explain in plain English.
 * `hint` is printed to the user; `cause` keeps the raw API detail for logs.
 */
class PlayError extends Error {
  constructor(message, hint, cause) {
    super(message);
    this.name = 'PlayError';
    this.hint = hint;
    this.cause = cause;
  }
}

const keyPath = () => path.resolve(ROOT, config.keyFile);
const resolvePath = (p) => path.resolve(ROOT, p);

function readKey() {
  const file = keyPath();
  if (!fs.existsSync(file)) {
    throw new PlayError(
      'No Play Console key found.',
      `Expected the robot-account key at:\n  ${file}\n\n` +
        'Download the JSON key from Google Cloud, then put it there.'
    );
  }
  let key;
  try {
    key = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new PlayError(
      'The key file is not readable.',
      `${file}\nIt does not look like the JSON key Google hands out. Re-download it.`,
      err
    );
  }
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) {
    throw new PlayError(
      'That is the wrong kind of key.',
      'The file must be a Google Cloud *service account* JSON key — it contains ' +
        '"type": "service_account" and a client_email ending in ' +
        '.iam.gserviceaccount.com. An OAuth client secret will not work.'
    );
  }
  return key;
}

function googleAuth() {
  readKey(); // fail early with a readable message
  return new gauth.GoogleAuth({ keyFile: keyPath(), scopes: [SCOPE] });
}

function client() {
  return androidpublisher({ version: 'v3', auth: googleAuth() });
}

/**
 * Play changes are staged inside an "edit" and only take effect on commit.
 * Anything thrown inside `fn` abandons the edit, so a half-finished change
 * never lands on the live listing.
 */
async function withEdit(fn, { commit = true, changesNotSentForReview = false } = {}) {
  const ap = client();
  const { packageName } = config;

  let editId;
  try {
    const { data } = await ap.edits.insert({ packageName });
    editId = data.id;
  } catch (err) {
    throw translate(err);
  }

  const abandon = async () => {
    try {
      await ap.edits.delete({ packageName, editId });
    } catch {
      // The edit expires on its own; nothing to recover here.
    }
  };

  let result;
  try {
    result = await fn({ ap, packageName, editId });
  } catch (err) {
    await abandon();
    throw translate(err);
  }

  if (!commit) {
    await abandon();
    return result;
  }

  try {
    await ap.edits.commit({ packageName, editId, changesNotSentForReview });
  } catch (err) {
    await abandon();
    throw translate(err);
  }
  return result;
}

/** Turn a Google API error into something worth reading. */
function translate(err) {
  if (err instanceof PlayError) return err;

  const status = err.status || err.code || err.response?.status;
  const detail =
    err.response?.data?.error?.message ||
    err.errors?.[0]?.message ||
    err.message ||
    String(err);
  const low = detail.toLowerCase();

  const as = (message, hint) => new PlayError(message, hint, err);

  if (low.includes('invalid_grant') || low.includes('invalid jwt')) {
    return as(
      'Google rejected the key.',
      'The key file is expired, revoked, or belongs to a deleted robot account. ' +
        'Create a fresh key in Google Cloud and replace the file.'
    );
  }
  if (status === 401) {
    return as('Google would not let us sign in.', detail);
  }
  if (status === 403) {
    if (low.includes('not been used') || low.includes('is disabled')) {
      return as(
        'The Play API is switched off for this Google Cloud project.',
        'Turn on "Google Play Android Developer API" in the Google Cloud console, ' +
          'then wait a minute and try again.'
      );
    }
    return as(
      'The robot account is not allowed to do that.',
      'In Play Console, open Users and permissions, find the robot account, and give it ' +
        'access to this app plus the permissions it needs (release to tracks, edit store listing).\n\n' +
        `Google said: ${detail}`
    );
  }
  if (status === 404) {
    return as(
      `Play Console has no app called ${config.packageName}.`,
      'Either the app has not been created in Play Console yet, or the robot account ' +
        'has not been given access to it. The app entry must be created by hand first.'
    );
  }
  if (low.includes('version code') && low.includes('already been used')) {
    return as(
      'That version number is already taken.',
      'Play will not accept the same version code twice. Bump versionCode in app.json ' +
        'and android/app/build.gradle, rebuild, and upload again.'
    );
  }
  if (low.includes('not been published') || low.includes('draft app')) {
    return as(
      'This app has never been published, so Play only accepts a draft release.',
      'Upload the first build by hand in Play Console. After that this tool can take over.'
    );
  }
  if (low.includes('apk') && low.includes('signed')) {
    return as('The build is signed with the wrong key.', detail);
  }

  return as('The Play API returned an error.', detail);
}

module.exports = {
  config,
  client,
  googleAuth,
  readKey,
  withEdit,
  translate,
  PlayError,
  keyPath,
  resolvePath,
  ROOT,
};
