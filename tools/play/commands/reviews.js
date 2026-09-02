'use strict';

const { config, client, translate, PlayError } = require('../lib/client');
const f = require('../lib/format');

const when = (stamp) =>
  stamp?.seconds ? new Date(Number(stamp.seconds) * 1000).toLocaleDateString() : '';

const stars = (n) => (Number.isFinite(n) ? '*'.repeat(n) + f.dim('.'.repeat(5 - n)) : '');

/**
 * Play only exposes reviews from roughly the last week through the API, so an
 * empty list here does not mean the app has no reviews at all.
 */
async function list(flags) {
  const ap = client();
  let reviews;
  try {
    const { data } = await ap.reviews.list({
      packageName: config.packageName,
      maxResults: Number(flags.limit) || 25,
      translationLanguage: flags.language || config.defaultLanguage,
    });
    reviews = data.reviews || [];
  } catch (err) {
    throw translate(err);
  }

  if (!reviews.length) {
    console.log(f.warn('No recent reviews. Play only returns roughly the last week through the API.'));
    return;
  }

  console.log(f.heading(`${reviews.length} recent review(s)`));
  for (const review of reviews) {
    const user = review.comments?.find((c) => c.userComment)?.userComment;
    const reply = review.comments?.find((c) => c.developerComment)?.developerComment;
    if (!user) continue;

    console.log(
      `\n${stars(user.starRating)}  ${f.bold(review.authorName || 'Anonymous')} ` +
        f.dim(`${when(user.lastModified)} · app ${user.appVersionName || user.appVersionCode || '?'}`)
    );
    if (user.text) console.log(`  ${user.text.replace(/\n/g, '\n  ')}`);
    console.log(f.dim(`  id: ${review.reviewId}`));
    if (reply?.text) console.log(f.dim(`  replied ${when(reply.lastModified)}: ${reply.text}`));
  }
}

async function reply(flags) {
  if (!flags.id) throw new PlayError('Which review?', 'Pass --id with the review id shown by "reviews list".');
  if (!flags.text) throw new PlayError('Nothing to say.', 'Pass --text with the reply.');
  if (flags.text.length > 350) {
    throw new PlayError('That reply is too long.', `Play allows 350 characters; this is ${flags.text.length}.`);
  }
  // A reply is public and permanent, so it takes an explicit go-ahead.
  if (!flags.confirm) {
    throw new PlayError(
      'Refusing to post a public reply without confirmation.',
      `This would appear publicly under the review:\n\n  "${flags.text}"\n\n` +
        'Re-run with --confirm once the owner has approved the wording.'
    );
  }

  const ap = client();
  try {
    await ap.reviews.reply({
      packageName: config.packageName,
      reviewId: flags.id,
      requestBody: { replyText: flags.text },
    });
  } catch (err) {
    throw translate(err);
  }
  console.log(`${f.green('Done.')} Reply posted.`);
}

module.exports = { list, reply };
