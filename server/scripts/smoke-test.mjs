// End-to-end API smoke test for TraceMate.
// Usage (server must be running): npm --prefix server run test:smoke
// Optional: API_BASE=http://localhost:5000/api npm --prefix server run test:smoke
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const SERVER = BASE.replace(/\/api\/?$/, '');
const stamp = Date.now();
const results = [];

async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  FAIL  ${name}\n        ${error.message.split('\n')[0]}`);
  }
}

const password = 'SmokeTest#12345';
const state = {};

console.log(`\nTraceMate smoke test -> ${BASE}\n`);

await check('API health reports database connected', async () => {
  const { status, data } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.equal(data.database, 'connected');
});

await check('Register two users (owner A, claimant B)', async () => {
  const a = await call('POST', '/auth/register', { body: { name: 'Owner A', email: `owner.${stamp}@example.com`, password } });
  const b = await call('POST', '/auth/register', { body: { name: 'Claimant B', email: `claimant.${stamp}@example.com`, password } });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  state.a = a.data.token;
  state.b = b.data.token;
});

await check('Weak password is rejected', async () => {
  const { status } = await call('POST', '/auth/register', { body: { name: 'Weak', email: `weak.${stamp}@example.com`, password: 'short' } });
  assert.equal(status, 400);
});

await check('Login works and wrong password is rejected', async () => {
  const ok = await call('POST', '/auth/login', { body: { email: `owner.${stamp}@example.com`, password } });
  const bad = await call('POST', '/auth/login', { body: { email: `owner.${stamp}@example.com`, password: 'WrongPassword!1' } });
  assert.equal(ok.status, 200);
  assert.equal(bad.status, 401);
});

await check('Creating a report requires sign-in', async () => {
  const { status } = await call('POST', '/items', { body: { title: 'x' } });
  assert.equal(status, 401);
});

await check('Owner A creates a found report', async () => {
  const { status, data } = await call('POST', '/items', {
    token: state.a,
    body: {
      title: 'Black wireless headphones', type: 'found', category: 'Electronics',
      description: 'Black over-ear headphones left near the reading area', location: 'MIT-WPU Library',
      contactName: 'Owner A', contactEmail: 'owner@example.com', contactPhone: '+91 98765 43210'
    }
  });
  assert.equal(status, 201);
  state.itemId = data.item._id;
});

await check('Public feed hides contact details and owner id', async () => {
  const { data } = await call('GET', '/items');
  const item = data.items.find((i) => i._id === state.itemId);
  assert.ok(item, 'item should be listed');
  assert.equal(item.contactPhone, undefined);
  assert.equal(item.contactEmail, undefined);
  assert.equal(item.contactName, undefined);
  assert.equal(item.owner, undefined);
  assert.equal(item.isOwner, false);
});

await check('Owner sees own contact details and isOwner=true', async () => {
  const { data } = await call('GET', '/items', { token: state.a });
  const item = data.items.find((i) => i._id === state.itemId);
  assert.equal(item.isOwner, true);
  assert.equal(item.contactPhone, '+91 98765 43210');
});

await check('Search filter finds the report', async () => {
  const { data } = await call('GET', '/items?search=headphones&type=found');
  assert.ok(data.items.some((i) => i._id === state.itemId));
});

await check('Another user cannot edit or delete the report', async () => {
  const patch = await call('PATCH', `/items/${state.itemId}`, { token: state.b, body: { title: 'Hacked title' } });
  const del = await call('DELETE', `/items/${state.itemId}`, { token: state.b });
  assert.equal(patch.status, 403);
  assert.equal(del.status, 403);
});

await check('Owner can edit the report', async () => {
  const { status, data } = await call('PATCH', `/items/${state.itemId}`, { token: state.a, body: { description: 'Black over-ear headphones with a small scratch on the left side' } });
  assert.equal(status, 200);
  assert.match(data.item.description, /scratch/);
});

await check('Owner cannot claim their own report', async () => {
  const { status } = await call('POST', '/claims', { token: state.a, body: { itemId: state.itemId, message: 'mine' } });
  assert.equal(status, 400);
});

await check('Claimant B submits a claim; item becomes claim-pending', async () => {
  const { status, data } = await call('POST', '/claims', {
    token: state.b,
    body: { itemId: state.itemId, message: 'These are my headphones.', privateProof: 'Left cup has a sticker of a star.' }
  });
  assert.equal(status, 201);
  state.claimId = data.claim._id;
  const item = await call('GET', `/items/${state.itemId}`);
  assert.equal(item.data.item.status, 'claim-pending');
});

await check('Duplicate active claim is blocked', async () => {
  const { status } = await call('POST', '/claims', { token: state.b, body: { itemId: state.itemId, message: 'again' } });
  assert.equal(status, 409);
});

await check('Claimant does not see owner contact before approval', async () => {
  const { data } = await call('GET', '/claims/mine', { token: state.b });
  const claim = data.claims.find((c) => c._id === state.claimId);
  assert.equal(claim.handover, null);
  assert.equal(claim.item.contactPhone, undefined);
});

await check('Owner sees claim with proof but no claimant contact yet', async () => {
  const { data } = await call('GET', '/claims/received', { token: state.a });
  const claim = data.claims.find((c) => c._id === state.claimId);
  assert.ok(claim);
  assert.match(claim.privateProof, /sticker/);
  assert.equal(claim.claimant.name, 'Claimant B');
  assert.equal(claim.claimant.email, undefined);
});

await check('Non-owner cannot review the claim', async () => {
  const { status } = await call('PATCH', `/claims/${state.claimId}/status`, { token: state.b, body: { status: 'approved' } });
  assert.equal(status, 403);
});

await check('Invalid claim transition is rejected (pending -> completed)', async () => {
  const { status } = await call('PATCH', `/claims/${state.claimId}/status`, { token: state.a, body: { status: 'completed' } });
  assert.equal(status, 409);
});

await check('Owner approves; item becomes claimed; handover details unlock', async () => {
  const review = await call('PATCH', `/claims/${state.claimId}/status`, { token: state.a, body: { status: 'approved', note: 'Proof matches' } });
  assert.equal(review.status, 200);
  const item = await call('GET', `/items/${state.itemId}`);
  assert.equal(item.data.item.status, 'claimed');
  const mine = await call('GET', '/claims/mine', { token: state.b });
  const claim = mine.data.claims.find((c) => c._id === state.claimId);
  assert.equal(claim.handover.contactPhone, '+91 98765 43210');
});

await check('Owner marks handover complete; item becomes returned', async () => {
  const review = await call('PATCH', `/claims/${state.claimId}/status`, { token: state.a, body: { status: 'completed' } });
  assert.equal(review.status, 200);
  const item = await call('GET', `/items/${state.itemId}`);
  assert.equal(item.data.item.status, 'returned');
});

await check('Withdrawing a pending claim restores the item to open', async () => {
  const created = await call('POST', '/items', {
    token: state.a,
    body: { title: 'Blue notebook', type: 'lost', category: 'Stationery', description: 'Blue notebook with lecture notes', location: 'Academic Block' }
  });
  const itemId = created.data.item._id;
  const claim = await call('POST', '/claims', { token: state.b, body: { itemId, message: 'I found a notebook like this' } });
  assert.equal(claim.status, 201);
  const withdraw = await call('DELETE', `/claims/${claim.data.claim._id}`, { token: state.b });
  assert.equal(withdraw.status, 200);
  const item = await call('GET', `/items/${itemId}`);
  assert.equal(item.data.item.status, 'open');
  state.item2 = itemId;
});

await check('Match suggestions return explainable scores', async () => {
  await call('POST', '/items', {
    token: state.b,
    body: { title: 'Black headphones', type: 'lost', category: 'Electronics', description: 'Black over-ear headphones lost near library', location: 'MIT-WPU Library' }
  });
  const { status, data } = await call('GET', `/items/${state.itemId}/matches`);
  assert.equal(status, 200);
  assert.ok(data.matches.length >= 1);
  assert.ok(data.matches[0].reasons.length >= 1);
});

await check('AI recovery assistant answers without an API key', async () => {
  const { status, data } = await call('POST', '/ai/recovery-assistant', { body: { query: 'black headphones near the library' } });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.matches));
});

await check('AI analyse suggests a category', async () => {
  const { status, data } = await call('POST', '/ai/analyze', { body: { description: 'Lost my black laptop charger near the canteen' } });
  assert.equal(status, 200);
  assert.equal(data.category, 'Electronics');
});

await check('Agent plan runs and produces tasks for the owner', async () => {
  const plan = await call('POST', '/ai/agent/plan', { token: state.a, body: {} });
  assert.equal(plan.status, 200);
  const tasks = await call('GET', '/ai/agent/tasks', { token: state.a });
  assert.equal(tasks.status, 200);
  assert.ok(tasks.data.summary);
});

await check('Invalid ID returns 400 JSON and server stays alive', async () => {
  const bad = await call('PATCH', '/ai/agent/tasks/not-an-id', { token: state.a, body: { status: 'completed' } });
  assert.equal(bad.status, 400);
  const health = await call('GET', '/health');
  assert.equal(health.status, 200);
});

await check('Photo upload accepts PNG and rejects other types', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const good = new FormData();
  good.append('photo', new Blob([png], { type: 'image/png' }), 'tiny.png');
  const ok = await call('POST', '/uploads', { token: state.a, body: good, raw: true });
  assert.equal(ok.status, 201);
  const file = await fetch(`${SERVER}${ok.data.photo.url}`);
  assert.equal(file.status, 200);

  const text = new FormData();
  text.append('photo', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
  const bad = await call('POST', '/uploads', { token: state.a, body: text, raw: true });
  assert.equal(bad.status, 400);
});

// ---------------------------------------------------------------- v1.1 features
await check('Notifications: owner was told about the claim; mark all read', async () => {
  const list = await call('GET', '/notifications', { token: state.a });
  assert.equal(list.status, 200);
  assert.ok(list.data.notifications.some((n) => n.type === 'claim-received'), 'claim-received notification expected');
  assert.ok(list.data.unread >= 1);
  const claimant = await call('GET', '/notifications', { token: state.b });
  assert.ok(claimant.data.notifications.some((n) => n.type === 'claim-approved'), 'claimant should be told the claim was approved');
  const done = await call('PATCH', '/notifications/read-all', { token: state.a });
  assert.equal(done.status, 200);
  const after = await call('GET', '/notifications', { token: state.a });
  assert.equal(after.data.unread, 0);
});

await check('Notifications require sign-in', async () => {
  assert.equal((await call('GET', '/notifications')).status, 401);
});

await check('New report triggers a possible-match alert for the other owner', async () => {
  await call('POST', '/items', { token: state.b, body: { title: 'Silver steel water bottle', type: 'found', category: 'Personal items', description: 'Silver steel water bottle found near sports ground bench', location: 'Sports Ground' } });
  await call('POST', '/items', { token: state.a, body: { title: 'Silver steel water bottle', type: 'lost', category: 'Personal items', description: 'Lost my silver steel water bottle near the sports ground bench', location: 'Sports Ground' } });
  const { data } = await call('GET', '/notifications', { token: state.b });
  assert.ok(data.notifications.some((n) => n.type === 'possible-match'), 'possible-match alert expected');
});

await check('Tampered or garbage JWT is rejected', async () => {
  assert.equal((await call('GET', '/auth/me', { token: `${state.a}x` })).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: 'not.a.jwt' })).status, 401);
});

await check('Malformed JSON body returns 400, not a crash', async () => {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  assert.equal(res.status, 400);
});

await check('Item validation: short description, future date, bad category are rejected', async () => {
  const base = { title: 'Black pen', type: 'lost', category: 'Stationery', description: 'A black pen with a gold clip', location: 'Library' };
  assert.equal((await call('POST', '/items', { token: state.a, body: { ...base, description: 'short' } })).status, 400);
  assert.equal((await call('POST', '/items', { token: state.a, body: { ...base, date: '2999-01-01' } })).status, 400);
  assert.equal((await call('POST', '/items', { token: state.a, body: { ...base, category: 'Weapons' } })).status, 400);
});

await check('Photo URLs that were not uploaded through the API are stripped', async () => {
  const { status, data } = await call('POST', '/items', { token: state.a, body: { title: 'Red umbrella', type: 'found', category: 'Accessories', description: 'Red umbrella left on a bench', location: 'Canteen', photos: [{ url: 'https://evil.example/x.png' }, { url: '/uploads/ok-file.png' }] } });
  assert.equal(status, 201);
  assert.deepEqual(data.item.photos.map((p) => p.url), ['/uploads/ok-file.png']);
  await call('DELETE', `/items/${data.item._id}`, { token: state.a });
});

await check('Upload with a fake image Content-Type but non-image bytes is rejected', async () => {
  const fake = new FormData();
  fake.append('photo', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'evil.png');
  const res = await call('POST', '/uploads', { token: state.a, body: fake, raw: true });
  assert.equal(res.status, 400);
});

await check('Flagging: own report blocked, duplicate blocked, 3 flags auto-hide the report', async () => {
  const created = await call('POST', '/items', { token: state.a, body: { title: 'Suspicious listing', type: 'found', category: 'Other', description: 'Totally real listing that is spam', location: 'Main Gate' } });
  const id = created.data.item._id;
  state.flagged = id;
  assert.equal((await call('POST', `/items/${id}/flag`, { token: state.a, body: { reason: 'my own' } })).status, 400);
  assert.equal((await call('POST', `/items/${id}/flag`, { token: state.b, body: { reason: 'x' } })).status, 400, 'reason too short');
  assert.equal((await call('POST', `/items/${id}/flag`, { token: state.b, body: { reason: 'Looks like spam' } })).status, 200);
  assert.equal((await call('POST', `/items/${id}/flag`, { token: state.b, body: { reason: 'Looks like spam' } })).status, 409);
  const extra = [];
  for (let i = 0; i < 2; i += 1) {
    const r = await call('POST', '/auth/register', { body: { name: `Flagger ${i}`, email: `flagger${i}.${stamp}@example.com`, password } });
    extra.push(r.data.token);
    await call('POST', `/items/${id}/flag`, { token: r.data.token, body: { reason: 'Spam listing again' } });
  }
  const feed = await call('GET', '/items');
  assert.ok(!feed.data.items.some((i) => i._id === id), 'hidden report must leave the public feed');
  const direct = await call('GET', `/items/${id}`);
  assert.equal(direct.status, 404);
  const ownerView = await call('GET', `/items/${id}`, { token: state.a });
  assert.equal(ownerView.status, 200, 'owner can still see their hidden report');
});

await check('Admin endpoints reject non-admin users', async () => {
  assert.equal((await call('GET', '/admin/stats')).status, 401);
  assert.equal((await call('GET', '/admin/stats', { token: state.a })).status, 403);
});

await check('Admin moderation (needs ADMIN_EMAILS=admin@tracemate.test on the server)', async () => {
  const email = 'admin@tracemate.test';
  let login = await call('POST', '/auth/login', { body: { email, password } });
  if (login.status !== 200) login = await call('POST', '/auth/register', { body: { name: 'Smoke Admin', email, password } });
  const token = login.data.token;
  if (login.data.user?.role !== 'admin') {
    console.log('        (skipped: set ADMIN_EMAILS=admin@tracemate.test in server/.env to run this check)');
    return;
  }
  const stats = await call('GET', '/admin/stats', { token });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.items >= 1);
  const flagged = await call('GET', '/admin/items?filter=flagged', { token });
  assert.ok(flagged.data.items.some((i) => i._id === state.flagged), 'flagged item should be in the moderation queue');
  const restore = await call('PATCH', `/admin/items/${state.flagged}`, { token, body: { action: 'clear-flags' } });
  assert.equal(restore.status, 200);
  const feed = await call('GET', '/items');
  assert.ok(feed.data.items.some((i) => i._id === state.flagged), 'cleared item should be visible again');
  assert.equal((await call('PATCH', `/admin/items/${state.flagged}`, { token, body: { action: 'explode' } })).status, 400);
  const removed = await call('DELETE', `/admin/items/${state.flagged}`, { token });
  assert.equal(removed.status, 200);
  const users = await call('GET', '/admin/users', { token });
  assert.equal(users.status, 200);
  assert.ok(users.data.users.every((u) => u.passwordHash === undefined && u.email));
});

await check('Owner can delete reports (cleanup)', async () => {
  const one = await call('DELETE', `/items/${state.itemId}`, { token: state.a });
  const two = await call('DELETE', `/items/${state.item2}`, { token: state.a });
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
