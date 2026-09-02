'use strict';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

const bold = wrap(1);
const dim = wrap(2);
const green = wrap(32);
const yellow = wrap(33);
const red = wrap(31);
const cyan = wrap(36);

const heading = (text) => `\n${bold(text)}\n${dim('-'.repeat(text.length))}`;
const ok = (text) => `${green('OK')}  ${text}`;
const warn = (text) => `${yellow('!')}   ${text}`;
const fail = (text) => `${red('X')}   ${text}`;

function bytes(n) {
  if (!Number.isFinite(n)) return '?';
  const mb = n / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

/** Two-column key/value block, right-aligned keys. */
function pairs(entries) {
  const rows = entries.filter(([, v]) => v !== undefined && v !== null && v !== '');
  const width = rows.reduce((w, [k]) => Math.max(w, k.length), 0);
  return rows.map(([k, v]) => `  ${dim(k.padStart(width))}  ${v}`).join('\n');
}

module.exports = { bold, dim, green, yellow, red, cyan, heading, ok, warn, fail, bytes, pairs };
