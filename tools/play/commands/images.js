'use strict';

const fs = require('fs');
const path = require('path');
const { config, withEdit, ROOT, PlayError } = require('../lib/client');
const f = require('../lib/format');

// Google's exact requirements. Single-image types are replaced wholesale;
// screenshot types are galleries.
const TYPES = {
  icon: { single: true, size: [512, 512] },
  featureGraphic: { single: true, size: [1024, 500] },
  tvBanner: { single: true, size: [1280, 720] },
  phoneScreenshots: { single: false, min: 2, max: 8 },
  sevenInchScreenshots: { single: false, max: 8 },
  tenInchScreenshots: { single: false, max: 8 },
  tvScreenshots: { single: false, max: 8 },
  wearScreenshots: { single: false, max: 8 },
};

const storeDir = (language) => path.join(ROOT, 'store', language);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/** Read width/height straight out of a PNG header — no image library needed. */
function pngSize(file) {
  if (path.extname(file).toLowerCase() !== '.png') return null;
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    if (fs.readSync(fd, head, 0, 24, 0) < 24) return null;
  } finally {
    fs.closeSync(fd);
  }
  if (head.toString('ascii', 1, 4) !== 'PNG') return null;
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

function collect(language) {
  const dir = storeDir(language);
  if (!fs.existsSync(dir)) return {};
  const found = {};
  for (const [type, spec] of Object.entries(TYPES)) {
    if (spec.single) {
      const hit = ['.png', '.jpg', '.jpeg']
        .map((ext) => path.join(dir, type + ext))
        .find((p) => fs.existsSync(p));
      if (hit) found[type] = [hit];
    } else {
      const sub = path.join(dir, type);
      if (!fs.existsSync(sub)) continue;
      const files = fs
        .readdirSync(sub)
        .filter((n) => MIME[path.extname(n).toLowerCase()])
        .sort()
        .map((n) => path.join(sub, n));
      if (files.length) found[type] = files;
    }
  }
  return found;
}

async function list(flags) {
  const language = flags.language || config.defaultLanguage;
  const results = await withEdit(
    async ({ ap, packageName, editId }) => {
      const out = {};
      for (const type of Object.keys(TYPES)) {
        const { data } = await ap.edits.images
          .list({ packageName, editId, language, imageType: type })
          .catch(() => ({ data: {} }));
        out[type] = (data.images || []).length;
      }
      return out;
    },
    { commit: false }
  );

  console.log(f.heading(`Images on Play (${language})`));
  console.log(f.pairs(Object.entries(results).map(([type, n]) => [type, n ? `${n}` : f.dim('none')])));

  const local = collect(language);
  console.log(f.heading(`Images in this project (${language})`));
  const rows = Object.entries(local).map(([type, files]) => [type, `${files.length}`]);
  console.log(rows.length ? f.pairs(rows) : `  ${f.dim('none — add them under store/' + language + '/')}`);
}

async function push(flags) {
  const language = flags.language || config.defaultLanguage;
  const local = collect(language);
  const only = flags.only ? flags.only.split(',').map((s) => s.trim()) : null;
  const selected = Object.entries(local).filter(([type]) => !only || only.includes(type));

  if (!selected.length) {
    throw new PlayError(
      'No images to upload.',
      `Put them under:\n  ${storeDir(language)}\n\n` +
        'Single images are named after their type (icon.png, featureGraphic.png). ' +
        'Screenshots go in a folder named after their type, uploaded in filename order.'
    );
  }

  const problems = [];
  for (const [type, files] of selected) {
    const spec = TYPES[type];
    if (spec.max && files.length > spec.max) {
      problems.push(`${type}: ${files.length} images, Play allows at most ${spec.max}.`);
    }
    if (spec.min && files.length < spec.min) {
      problems.push(`${type}: ${files.length} image(s), Play needs at least ${spec.min}.`);
    }
    for (const file of files) {
      const size = pngSize(file);
      if (spec.size && size && (size[0] !== spec.size[0] || size[1] !== spec.size[1])) {
        problems.push(
          `${path.basename(file)} is ${size[0]}x${size[1]}; ${type} must be ${spec.size[0]}x${spec.size[1]}.`
        );
      }
    }
  }
  if (problems.length) {
    throw new PlayError('Some images do not meet Play\'s requirements.', problems.join('\n'));
  }

  console.log(f.heading(`Uploading images (${language})`));
  console.log(f.pairs(selected.map(([type, files]) => [type, `${files.length} file(s)`])));

  if (flags['dry-run']) {
    console.log(`\n${f.yellow('Dry run')} — nothing was sent to Google.`);
    return;
  }

  await withEdit(async ({ ap, packageName, editId }) => {
    for (const [type, files] of selected) {
      // Replace rather than add, so re-running does not pile up duplicates.
      await ap.edits.images.deleteall({ packageName, editId, language, imageType: type });
      for (const file of files) {
        await ap.edits.images.upload({
          packageName,
          editId,
          language,
          imageType: type,
          media: {
            mimeType: MIME[path.extname(file).toLowerCase()],
            body: fs.createReadStream(file),
          },
        });
      }
      console.log(f.ok(`${type}: ${files.length} uploaded`));
    }
  });

  console.log(`\n${f.green('Done.')} Store images updated.`);
}

module.exports = { list, push };
