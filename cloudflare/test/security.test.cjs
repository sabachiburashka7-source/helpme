// Security test for the Kheli Worker: runs src/index.js's fetch handler
// against wrangler's in-memory local D1 + KV (nothing is persisted, nothing
// touches production) with a stand-in for OpenAI, then tries every way a
// stranger could act as someone else - and checks the app's own flows,
// including the old builds 11/12, still work.
//
//   cd helpme/cloudflare && node test/security.test.cjs
//
// Needs wrangler: a local install, or the copy `npx wrangler` keeps in the
// npm cache (run any `npx --yes wrangler --version` once first).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

function loadWrangler() {
  try {
    return require('wrangler');
  } catch {}
  const caches = [
    path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
    path.join(os.homedir(), '.npm', '_npx'),
  ];
  const found = [];
  for (const dir of caches) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const pkg = path.join(dir, entry, 'node_modules', 'wrangler', 'package.json');
      if (fs.existsSync(pkg)) found.push({ dir: path.dirname(pkg), mtime: fs.statSync(pkg).mtimeMs });
    }
  }
  if (!found.length) throw new Error('wrangler not found - run: npx --yes wrangler --version');
  found.sort((a, b) => b.mtime - a.mtime);
  return require(found[0].dir);
}

const { getPlatformProxy } = loadWrangler();

const ROOT = path.join(__dirname, '..');
const TEST = '+995555000001';
const OTP = '424242';
const LEGACY_A = '+995599000111';
const LEGACY_B = '+995599000222';
const VICTIM = '+995599000333';
const STRANGER = '+995599000999';

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log('  ok   ', name);
  } else {
    failed++;
    console.log('  FAIL ', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300));
  }
}

function schemaStatements() {
  const sql = fs
    .readFileSync(path.join(ROOT, 'schema.sql'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
  return sql.split(';').map((s) => s.trim()).filter(Boolean);
}

// Stand-in for OpenAI: random bytes each call, so a second generation would
// show up as different stored bytes.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.openai.com/')) {
    return Response.json({ data: [{ b64_json: crypto.randomBytes(24).toString('base64') }] });
  }
  return realFetch(url, init);
};

async function loadWorker() {
  let src = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  src = src
    .replace("import PRIVACY_HTML from './privacy.html';", "const PRIVACY_HTML = 'privacy';")
    .replace("import DELETE_ACCOUNT_HTML from './delete-account.html';", "const DELETE_ACCOUNT_HTML = 'delete';");
  if (/^import /m.test(src)) throw new Error('unexpected import left in worker source');
  const out = path.join(os.tmpdir(), `kheli-worker-${process.pid}.mjs`);
  fs.writeFileSync(out, src);
  return (await import(pathToFileURL(out).href + '?v=' + Date.now())).default;
}

async function setup(db) {
  for (const stmt of schemaStatements()) await db.prepare(stmt).run();
  return db;
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function addAccount(db, phone, name, { token, used } = {}) {
  await db
    .prepare(
      `INSERT INTO users (id, phone, name, profile_image, tier, subscription_expires_at, created_at)
       VALUES (?, ?, ?, NULL, 'free', NULL, ?)`
    )
    .bind(crypto.randomUUID(), phone, name, new Date().toISOString())
    .run();
  if (token) {
    const now = new Date().toISOString();
    await db
      .prepare('INSERT INTO sessions (token_hash, phone, created_at, last_used_at) VALUES (?, ?, ?, ?)')
      .bind(sha256Hex(token), phone, now, used ? now : null)
      .run();
  }
}

function client(worker, env) {
  return async function call(method, url, { token, body, ip = '9.9.9.9', build } = {}) {
    const headers = { 'CF-Connecting-IP': ip };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (build) headers['X-Kheli-Build'] = String(build);
    const r = await worker.fetch(
      new Request(`https://api.test${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env
    );
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data };
  };
}

const auth = (call, body, opts = {}) => call('POST', '/api/auth', { ...opts, body });

async function main() {
  const proxy = await getPlatformProxy({ configPath: path.join(ROOT, 'wrangler.jsonc'), persist: false });
  const worker = await loadWorker();
  const secrets = { TEST_PHONE: TEST, TEST_OTP: OTP, OPENAI_API_KEY: 'sk-test' };
  const env = { ...proxy.env, ...secrets };
  const db = await setup(env.DB);
  const call = client(worker, env);
  const kv = env.IMAGES;

  console.log('\n# Reviewer sign-in and the guess limit');
  let r = await auth(call, { action: 'send_code', intent: 'login', phone: TEST });
  check('send_code for the test phone answers sent', r.status === 200 && r.data.status === 'sent', r);

  for (let i = 1; i <= 10; i++) {
    r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: '000000' }, { ip: '1.1.1.1' });
    check(`wrong code #${i} is refused`, r.status === 401 && r.data.error === 'Incorrect or expired code', r);
  }
  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '1.1.1.1' });
  check('11th try from the same network is locked out, even with the right code', r.status === 429, r);

  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '2.2.2.2' });
  check('right code from another network signs in', r.status === 200 && typeof r.data.token === 'string' && r.data.token.length >= 40, r);
  check('the reviewer account is created on first sign-in', r.data.name === 'Play Store Reviewer' && r.data.phone === TEST, r.data);
  const reviewer = r.data.token;

  for (let i = 0; i < 10; i++) {
    await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: '111111' }, { ip: `2001:db8:1:2::${i + 1}` });
  }
  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '2001:db8:1:2:ffff::9' });
  check('IPv6: new address in the same /64 is still locked out', r.status === 429, r);
  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '2001:db8:1:3::1' });
  check('IPv6: a different /64 can sign in', r.status === 200 && r.data.token, r);

  const stored = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?').bind(reviewer).first();
  check('the raw token is not what the database stores', stored.n === 0, stored);

  console.log('\n# Session basics');
  r = await auth(call, { action: 'me', phone: TEST });
  check('me without a token is refused (426)', r.status === 426 && r.data.code === 'update_required', r);
  r = await auth(call, { action: 'me' }, { token: 'not-a-real-token-at-all-000000000000' });
  check('me with a made-up token is refused (401 session_invalid)', r.status === 401 && r.data.code === 'session_invalid', r);
  r = await auth(call, { action: 'me' }, { token: reviewer, build: 13 });
  check('me with the real token works', r.status === 200 && r.data.phone === TEST && !('token' in r.data), r);
  r = await auth(call, { action: 'me' }, { token: reviewer, build: 12 });
  check('a build below MIN_BUILD is told to update', r.status === 426, r);
  r = await call('GET', '/api/image/whatever.png', { build: 12 });
  check('...but pictures still load for it', r.status === 404, r);

  // Accounts that already exist: two on the old build, one on the new one.
  await addAccount(db, LEGACY_A, 'Legacy Anna');
  await addAccount(db, LEGACY_B, 'Legacy Bob');
  const victim = 'victim-token-' + crypto.randomBytes(16).toString('hex');
  await addAccount(db, VICTIM, 'Victim Vera', { token: victim, used: true });

  console.log('\n# Posting');
  r = await call('POST', '/api/offers', {
    token: reviewer,
    body: {
      description: 'Fix my sink', price: 20, location: 'Tbilisi', category: 'Other',
      name: 'Hacker', phone: VICTIM, profile_image: 'https://evil.example/p.png',
      images: ['data:image/png;base64,AAAA', 'https://evil.example/x.png'],
    },
  });
  check('signed-in post works', r.status === 201, r);
  check('...and is filed under the session phone, not the body phone', r.data.phone === TEST, r.data);
  check('...with the account name, not the body name', r.data.name === 'Play Store Reviewer', r.data);
  check('...and outside-server photos are dropped', JSON.stringify(r.data.images) === '["data:image/png;base64,AAAA"]' && r.data.profile_image === null, r.data);
  const reviewerOffer = r.data.id;

  r = await call('POST', '/api/offers', { body: { description: 'x', price: 1, phone: VICTIM } });
  check('no-token post as an upgraded account is refused', r.status === 426, r);
  r = await call('POST', '/api/offers', { body: { description: 'x', price: 1, phone: STRANGER } });
  check('no-token post as a number with no account is refused', r.status === 426, r);
  r = await call('POST', '/api/offers', { body: { description: 'Old build post', price: 5, phone: LEGACY_A, name: 'Fake Name' } });
  check('no-token post from an old-build account works during the window', r.status === 201 && r.data.phone === LEGACY_A && r.data.name === 'Legacy Anna', r);
  const legacyOffer = r.data.id;
  r = await call('POST', '/api/offers', { token: victim, body: { description: 'Walk my dog', price: 10 } });
  check('victim posts with their own token', r.status === 201 && r.data.phone === VICTIM, r);
  const victimOffer = r.data.id;

  console.log('\n# Illustrations');
  r = await call('POST', '/api/generate-image', { token: reviewer, body: { id: victimOffer, description: 'something nasty' } });
  check('cannot illustrate someone else\'s offer', r.status === 403, r);
  r = await call('POST', '/api/generate-image', { body: { id: victimOffer } });
  check('no token cannot illustrate an upgraded owner\'s offer', r.status === 426, r);
  r = await call('POST', '/api/generate-image', { token: victim, body: { id: victimOffer, description: 'ignored' } });
  check('owner can illustrate their offer', r.status === 200 && /\/api\/image\/.+\.png$/.test(r.data.image), r);
  const firstBytes = await kv.get(victimOffer, 'arrayBuffer');
  const row = await db.prepare('SELECT image FROM offers WHERE id = ?').bind(victimOffer).first();
  check('...the server saves the image URL on the offer itself', row.image === r.data.image, row);
  const firstUrl = r.data.image;
  r = await call('POST', '/api/generate-image', { token: victim, body: { id: victimOffer } });
  const secondBytes = await kv.get(victimOffer, 'arrayBuffer');
  check('asking again returns the same picture without a new one', r.status === 200 && r.data.image === firstUrl && Buffer.compare(Buffer.from(firstBytes), Buffer.from(secondBytes)) === 0, r);
  r = await call('POST', '/api/generate-image', { body: { id: legacyOffer } });
  check('old build can still illustrate its own new offer during the window', r.status === 200, r);

  console.log('\n# Editing');
  r = await call('PATCH', '/api/offers', { token: reviewer, body: { id: victimOffer, description: 'hacked' } });
  check('cannot edit someone else\'s offer', r.status === 403, r);
  r = await call('PATCH', '/api/update-offer', { token: reviewer, body: { id: victimOffer, description: 'hacked' } });
  check('...not through /api/update-offer either', r.status === 403, r);
  r = await call('PATCH', '/api/offers', { body: { id: victimOffer, description: 'hacked', image: 'https://evil.example/x.png' } });
  const afterNoToken = await db.prepare('SELECT description, image FROM offers WHERE id = ?').bind(victimOffer).first();
  check('no-token edit changes nothing', r.status === 200 && afterNoToken.description === 'Walk my dog' && afterNoToken.image === firstUrl, afterNoToken);
  r = await call('PATCH', '/api/offers', { token: reviewer, body: { id: reviewerOffer, description: 'Fix my kitchen sink', name: 'Someone Else', image: 'https://evil.example/x.png' } });
  const edited = await db.prepare('SELECT description, name, image FROM offers WHERE id = ?').bind(reviewerOffer).first();
  check('owner can edit the text, but not the name or the picture', r.status === 200 && edited.description === 'Fix my kitchen sink' && edited.name === 'Play Store Reviewer' && edited.image === null, edited);

  console.log('\n# Reports');
  r = await call('POST', '/api/report', { body: { offer_id: victimOffer, reporter_phone: LEGACY_A, reason: 'spam' } });
  check('no-token report is refused', r.status === 426, r);
  r = await call('POST', '/api/report', { token: reviewer, body: { offer_id: victimOffer, reporter_phone: LEGACY_B, reason: 'spam' } });
  const rep = await db.prepare('SELECT reporter_phone FROM reports WHERE offer_id = ?').bind(victimOffer).first();
  check('report is filed under the session phone, not the body phone', r.status === 201 && rep && rep.reporter_phone === TEST, rep);
  r = await call('POST', '/api/report', { token: reviewer, body: { offer_id: reviewerOffer, reason: 'spam' } });
  check('cannot report your own offer', r.status === 400, r);

  console.log('\n# Blocks');
  r = await call('GET', `/api/blocks?phone=${encodeURIComponent(VICTIM)}`);
  check('no-token read of a block list is refused', r.status === 426, r);
  r = await call('POST', '/api/blocks', { body: { blocker_phone: VICTIM, blocked_phone: TEST } });
  check('no-token block is refused', r.status === 426, r);
  r = await call('POST', '/api/blocks', { token: reviewer, body: { offer_id: victimOffer, blocker_phone: VICTIM } });
  check('signed-in block works', r.status === 201 && r.data.blocked_phone === VICTIM, r);
  r = await call('GET', `/api/blocks?phone=${encodeURIComponent(TEST)}`, { token: victim });
  check('someone else cannot read my block list via ?phone=', r.status === 200 && Array.isArray(r.data) && r.data.length === 0, r);
  r = await call('GET', '/api/blocks', { token: reviewer });
  check('I can read my own block list', r.status === 200 && r.data.length === 1 && r.data[0].phone === VICTIM, r);
  r = await call('DELETE', '/api/blocks', { token: reviewer, body: { blocked_phone: VICTIM } });
  check('I can unblock', r.status === 200, r);

  console.log('\n# Profile photo, subscription');
  r = await auth(call, { action: 'update_profile_image', phone: VICTIM, profile_image: null });
  check('no-token photo change is refused', r.status === 426, r);
  r = await auth(call, { action: 'update_profile_image', profile_image: 'https://evil.example/p.png' }, { token: reviewer });
  check('photo must be a picture from the phone, not a link', r.status === 400, r);
  r = await auth(call, { action: 'update_profile_image', profile_image: 'data:image/jpeg;base64,BBBB' }, { token: reviewer });
  const photoOnOffer = await db.prepare('SELECT profile_image FROM offers WHERE id = ?').bind(reviewerOffer).first();
  check('signed-in photo change works and reaches my offers', r.status === 200 && r.data.profile_image === 'data:image/jpeg;base64,BBBB' && photoOnOffer.profile_image === 'data:image/jpeg;base64,BBBB', r);
  r = await auth(call, { action: 'cancel_subscription', phone: VICTIM });
  check('no-token subscription change is refused', r.status === 426, r);

  console.log('\n# Deleting offers');
  r = await call('DELETE', '/api/offers', { token: reviewer, body: { id: victimOffer } });
  check('cannot delete someone else\'s offer', r.status === 403, r);
  r = await call('DELETE', '/api/offers', { body: { id: victimOffer } });
  check('no token cannot delete an upgraded owner\'s offer', r.status === 426, r);
  r = await call('DELETE', '/api/offers', { token: victim, body: { id: victimOffer } });
  const goneOffer = await db.prepare('SELECT COUNT(*) AS n FROM offers WHERE id = ?').bind(victimOffer).first();
  const goneImage = await kv.get(victimOffer);
  check('owner deletes their offer, and its picture goes too', r.status === 200 && goneOffer.n === 0 && goneImage === null, { r, goneOffer, goneImage });
  r = await call('DELETE', '/api/offers', { body: { id: legacyOffer } });
  check('old build can delete an old-build owner\'s offer during the window', r.status === 200, r);

  console.log('\n# Feed');
  r = await call('GET', '/api/offers');
  check('no-token feed still loads during the window', r.status === 200 && Array.isArray(r.data), r);
  r = await call('GET', '/api/offers', { token: reviewer });
  check('signed-in feed includes my own offer', r.status === 200 && r.data.some((o) => o.id === reviewerOffer), r);

  console.log('\n# Sign out and sessions');
  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '3.3.3.3' });
  const second = r.data.token;
  r = await auth(call, { action: 'logout' }, { token: second });
  check('logout works', r.status === 200, r);
  r = await auth(call, { action: 'me' }, { token: second });
  check('a signed-out token is dead', r.status === 401 && r.data.code === 'session_invalid', r);
  r = await auth(call, { action: 'me' }, { token: reviewer });
  check('other devices stay signed in', r.status === 200, r);

  console.log('\n# Deleting an account');
  r = await auth(call, { action: 'delete_account', phone: VICTIM });
  const stillThere = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE phone = ?').bind(VICTIM).first();
  check('no-token delete_account is refused and deletes nothing', r.status === 426 && stillThere.n === 1, { r, stillThere });
  r = await call('POST', '/api/offers', { token: victim, body: { description: 'Paint a fence', price: 30 } });
  const victimOffer2 = r.data.id;
  await call('POST', '/api/generate-image', { token: victim, body: { id: victimOffer2 } });
  r = await auth(call, { action: 'delete_account', phone: TEST }, { token: victim });
  const left = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM users WHERE phone = ?) AS users,
              (SELECT COUNT(*) FROM offers WHERE phone = ?) AS offers,
              (SELECT COUNT(*) FROM sessions WHERE phone = ?) AS sessions,
              (SELECT COUNT(*) FROM users WHERE phone = ?) AS reviewer`
    )
    .bind(VICTIM, VICTIM, VICTIM, TEST)
    .first();
  check('delete_account deletes the caller (not the body phone): account, offers, sessions', r.status === 200 && left.users === 0 && left.offers === 0 && left.sessions === 0 && left.reviewer === 1, left);
  check('...and their pictures', (await kv.get(victimOffer2)) === null);
  r = await auth(call, { action: 'me' }, { token: victim });
  check('the deleted account\'s token is dead', r.status === 401, r);

  console.log('\n# Quotas');
  const bob = 'bob-token-' + crypto.randomBytes(16).toString('hex');
  await db.prepare('INSERT INTO sessions (token_hash, phone, created_at, last_used_at) VALUES (?, ?, ?, NULL)').bind(sha256Hex(bob), LEGACY_B, new Date().toISOString()).run();
  for (let i = 1; i <= 3; i++) {
    r = await call('POST', '/api/offers', { token: bob, body: { description: `Bob ${i}`, price: i } });
  }
  check('3 free posts work', r.status === 201, r);
  r = await call('POST', '/api/offers', { token: bob, body: { description: 'Bob 4', price: 4 } });
  check('the 4th in a month is refused', r.status === 402 && r.data.limit === 3, r);
  r = await call('POST', '/api/offers', { body: { description: 'Bob via old build', price: 4, phone: LEGACY_B } });
  check('once an account has used a token, the old no-token way is closed for it', r.status === 426, r);
  for (let i = 0; i < 20; i++) {
    r = await call('POST', '/api/offers', { token: reviewer, body: { description: `Review ${i}`, price: 1 } });
    if (r.status !== 201) break;
  }
  check('the reviewer account stops at 10 posts a day', r.status === 402 && r.data.limit === 10, r);

  console.log('\n# Idle sessions expire');
  await db.prepare('UPDATE sessions SET created_at = ?, last_used_at = ? WHERE phone = ?').bind('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', LEGACY_B).run();
  r = await auth(call, { action: 'me' }, { token: bob });
  check('a session idle for 180+ days is refused', r.status === 401 && r.data.code === 'session_invalid', r);

  console.log('\n# Global cap on reviewer-code guesses');
  await db.prepare('DELETE FROM auth_failures').run();
  for (let n = 0; n < 25; n++) {
    for (let i = 0; i < 4; i++) {
      await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: '222222' }, { ip: `10.0.${n}.1` });
    }
  }
  r = await auth(call, { action: 'verify_code', intent: 'login', phone: TEST, code: OTP }, { ip: '172.16.0.1' });
  check('after 100 wrong guesses in an hour from anywhere, the code is locked', r.status === 429, r);

  console.log('\n# After the legacy window closes');
  for (const table of ['reports', 'blocks', 'offers', 'sessions', 'auth_failures', 'users']) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }
  const db2 = db;
  const call2 = client(worker, { ...env, LEGACY_WRITES_UNTIL: '2020-01-01T00:00:00Z' });
  await addAccount(db2, LEGACY_A, 'Legacy Anna');
  const anna = 'anna-token-' + crypto.randomBytes(16).toString('hex');
  await addAccount(db2, LEGACY_B, 'Legacy Bob', { token: anna, used: false });
  r = await call2('POST', '/api/offers', { token: anna, body: { description: 'token post', price: 1 } });
  const closedOffer = r.data.id;
  r = await call2('GET', '/api/offers');
  check('no-token feed is refused', r.status === 426, r);
  r = await call2('POST', '/api/offers', { body: { description: 'x', price: 1, phone: LEGACY_A } });
  check('no-token post is refused', r.status === 426, r);
  r = await call2('DELETE', '/api/offers', { body: { id: closedOffer } });
  check('no-token delete is refused', r.status === 426, r);
  r = await call2('PATCH', '/api/offers', { body: { id: closedOffer, image: 'x' } });
  check('no-token edit is refused', r.status === 426, r);
  r = await call2('POST', '/api/generate-image', { body: { id: closedOffer } });
  check('no-token illustration is refused', r.status === 426, r);
  r = await call2('GET', '/api/offers', { token: anna });
  check('signed-in feed still works', r.status === 200 && r.data.length === 1, r);
  await proxy.dispose();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
