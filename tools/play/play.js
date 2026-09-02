#!/usr/bin/env node
'use strict';

const f = require('./lib/format');
const { PlayError, config } = require('./lib/client');

const COMMANDS = {
  doctor: { run: () => require('./commands/doctor'), help: 'Check that Play Console access works end to end' },
  status: { run: () => require('./commands/status'), help: 'What is on each track, and what is built locally' },
  upload: { run: () => require('./commands/upload'), help: 'Upload the release bundle to a track' },
  listing: {
    subs: { get: 'Pull the live store text into this project', push: 'Send the edited store text to Play' },
    run: () => require('./commands/listing'),
  },
  images: {
    subs: { list: 'What images Play has, and what this project has', push: 'Upload icon, feature graphic and screenshots' },
    run: () => require('./commands/images'),
  },
  reviews: {
    subs: { list: 'Recent user reviews', reply: 'Reply publicly to one review' },
    run: () => require('./commands/reviews'),
  },
  testers: {
    subs: { get: 'Which Google Groups can test a track', set: 'Replace the tester groups on a track' },
    run: () => require('./commands/testers'),
  },
};

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function usage() {
  console.log(`\n${f.bold('Play Console tools')} ${f.dim(`— ${config.packageName}`)}`);
  console.log(f.dim('\n  node play.js <command> [options]\n'));
  for (const [name, spec] of Object.entries(COMMANDS)) {
    if (spec.subs) {
      for (const [sub, help] of Object.entries(spec.subs)) {
        console.log(`  ${f.cyan(`${name} ${sub}`.padEnd(16))} ${help}`);
      }
    } else {
      console.log(`  ${f.cyan(name.padEnd(16))} ${spec.help}`);
    }
  }
  console.log(
    f.dim(
      '\n  Common options: --dry-run, --confirm, --track <name>, --language <code>\n' +
        '  Publishing to production and replying to reviews both need --confirm.\n'
    )
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const [name, maybeSub] = argv;

  if (!name || name === 'help' || name === '--help') {
    usage();
    return;
  }

  const spec = COMMANDS[name];
  if (!spec) {
    console.error(f.fail(`No command called "${name}".`));
    usage();
    process.exitCode = 1;
    return;
  }

  const mod = spec.run();
  const flags = parseFlags(argv);

  if (!spec.subs) {
    await mod(flags);
    return;
  }

  const sub = maybeSub && !maybeSub.startsWith('--') ? maybeSub : null;
  if (!sub || !mod[sub]) {
    console.error(f.fail(`"${name}" needs one of: ${Object.keys(spec.subs).join(', ')}`));
    process.exitCode = 1;
    return;
  }
  await mod[sub](flags);
}

main().catch((err) => {
  process.exitCode = 1;
  if (err instanceof PlayError) {
    console.error(`\n${f.red(err.message)}`);
    if (err.hint) console.error(`\n${err.hint}\n`);
  } else {
    console.error(`\n${f.red('Something went wrong.')}\n`);
    console.error(err.stack || err.message || String(err));
  }
});
