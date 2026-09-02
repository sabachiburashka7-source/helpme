'use strict';

const { withEdit, PlayError } = require('../lib/client');
const f = require('../lib/format');

const TESTABLE = ['internal', 'alpha', 'beta'];

/**
 * Closed testing needs 12+ testers for 14 straight days before production is
 * allowed. Play manages that list through Google Groups.
 */
async function get(flags) {
  const track = flags.track || 'alpha';
  const testers = await withEdit(
    async ({ ap, packageName, editId }) => {
      const { data } = await ap.edits.testers.get({ packageName, editId, track });
      return data;
    },
    { commit: false }
  );

  console.log(f.heading(`Testers on the ${track} track`));
  const groups = testers.googleGroups || [];
  console.log(groups.length ? f.pairs(groups.map((g) => ['group', g])) : `  ${f.dim('no groups attached')}`);
}

async function set(flags) {
  const track = flags.track || 'alpha';
  if (!TESTABLE.includes(track)) {
    throw new PlayError(`Cannot set testers on "${track}".`, `Testing tracks are: ${TESTABLE.join(', ')}.`);
  }
  if (!flags.groups) {
    throw new PlayError(
      'No tester groups given.',
      'Pass --groups with one or more Google Group addresses, comma separated. ' +
        'Create the group at groups.google.com first and add the testers to it.'
    );
  }
  const googleGroups = flags.groups.split(',').map((s) => s.trim()).filter(Boolean);

  console.log(f.heading(`Setting testers on the ${track} track`));
  console.log(f.pairs(googleGroups.map((g) => ['group', g])));

  if (flags['dry-run']) {
    console.log(`\n${f.yellow('Dry run')} — nothing was sent to Google.`);
    return;
  }

  await withEdit(async ({ ap, packageName, editId }) => {
    await ap.edits.testers.update({ packageName, editId, track, requestBody: { googleGroups } });
  });

  console.log(`\n${f.green('Done.')} This replaced the whole tester list for that track.`);
}

module.exports = { get, set };
