'use strict';

const fs = require('fs');
const path = require('path');
const { config, withEdit, ROOT, PlayError } = require('../lib/client');
const f = require('../lib/format');

const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };
const FIELDS = ['title', 'shortDescription', 'fullDescription', 'video'];

const fileFor = (language) => path.join(ROOT, 'listing', `${language}.json`);

function check(listing) {
  const problems = [];
  for (const [field, max] of Object.entries(LIMITS)) {
    const value = listing[field];
    if (!value) {
      problems.push(`${field} is empty — Play requires it.`);
    } else if (value.length > max) {
      problems.push(`${field} is ${value.length} characters; Play allows ${max}.`);
    }
  }
  return problems;
}

/** Pull the live listing out of Play and save it locally for editing. */
async function get(flags) {
  const listings = await withEdit(
    async ({ ap, packageName, editId }) => {
      const { data } = await ap.edits.listings.list({ packageName, editId });
      return data.listings || [];
    },
    { commit: false }
  );

  if (!listings.length) {
    console.log(f.warn('Play has no store listing text for this app yet.'));
    return;
  }

  fs.mkdirSync(path.join(ROOT, 'listing'), { recursive: true });
  for (const listing of listings) {
    const out = { language: listing.language };
    for (const field of FIELDS) if (listing[field]) out[field] = listing[field];
    fs.writeFileSync(fileFor(listing.language), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log(f.ok(`Saved the ${listing.language} listing`));
    console.log(f.pairs([['title', listing.title], ['short', listing.shortDescription]]));
  }
}

/** Send the locally edited listing text back up to Play. */
async function push(flags) {
  const language = flags.language || config.defaultLanguage;
  const file = fileFor(language);
  if (!fs.existsSync(file)) {
    throw new PlayError(
      `No listing text saved for ${language}.`,
      `Expected a file at:\n  ${file}\n\nRun "listing get" to pull the live text first.`
    );
  }

  const listing = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (listing._draft && !flags.confirm) {
    throw new PlayError(
      'That listing text is still marked as a draft.',
      'It is placeholder copy that has not been approved. Read it through, remove the ' +
        '"_draft" line from the file, and push again — or pass --confirm to send it as is.'
    );
  }

  const problems = check(listing);
  if (problems.length) {
    throw new PlayError('The listing text will not pass Play\'s rules.', problems.join('\n'));
  }

  const requestBody = { language };
  for (const field of FIELDS) if (listing[field]) requestBody[field] = listing[field];

  console.log(f.heading(`Pushing the ${language} store listing`));
  console.log(
    f.pairs([
      ['title', `${requestBody.title}  ${f.dim(`(${requestBody.title.length}/${LIMITS.title})`)}`],
      ['short', `${requestBody.shortDescription}  ${f.dim(`(${requestBody.shortDescription.length}/${LIMITS.shortDescription})`)}`],
      ['full', f.dim(`${requestBody.fullDescription.length}/${LIMITS.fullDescription} characters`)],
    ])
  );

  if (flags['dry-run']) {
    console.log(`\n${f.yellow('Dry run')} — nothing was sent to Google.`);
    return;
  }

  await withEdit(async ({ ap, packageName, editId }) => {
    await ap.edits.listings.update({ packageName, editId, language, requestBody });
  });

  console.log(`\n${f.green('Done.')} The ${language} store listing is updated.`);
}

module.exports = { get, push };
