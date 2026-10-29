import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, tokens } from '../src/utils/matching.js';
import { cleanPhotos, cleanPhone, isEmail } from '../src/utils/validate.js';

const today = new Date().toISOString();

test('tokens lowercases, strips punctuation and drops short words', () => {
  assert.deepEqual([...tokens('The BLACK, headphones!! of AB')], ['the', 'black', 'headphones']);
});

test('identical reports in the same place score very high with reasons', () => {
  const a = { title: 'Black headphones', description: 'Black over-ear headphones', category: 'Electronics', location: 'Library', date: today };
  const r = scoreMatch(a, { ...a });
  assert.ok(r.score >= 90, `expected >= 90, got ${r.score}`);
  assert.ok(r.reasons.includes('Same category'));
  assert.ok(r.reasons.includes('Same reported location'));
});

test('unrelated reports score low', () => {
  const a = { title: 'Blue notebook', description: 'Lecture notes', category: 'Stationery', location: 'Block B', date: today };
  const b = { title: 'Silver bottle', description: 'Steel flask', category: 'Personal items', location: 'Sports Ground', date: '2020-01-01' };
  assert.ok(scoreMatch(a, b).score < 15);
});

test('score never exceeds 100 and is symmetric', () => {
  const a = { title: 'Key ring', description: 'Three keys on a ring', category: 'Keys', location: 'Gate', date: today };
  const b = { title: 'Key ring', description: 'Three keys on a ring', category: 'Keys', location: 'Gate', date: today };
  assert.ok(scoreMatch(a, b).score <= 100);
  assert.equal(scoreMatch(a, b).score, scoreMatch(b, a).score);
});

test('partial location wording gives a smaller location bonus', () => {
  const base = { title: 'x item', description: 'y item', category: 'Other', date: today };
  const exact = scoreMatch({ ...base, location: 'MIT-WPU Library' }, { ...base, location: 'MIT-WPU Library' }).score;
  const partial = scoreMatch({ ...base, location: 'MIT-WPU Library' }, { ...base, location: 'Central Library block' }).score;
  assert.ok(exact > partial);
});

test('cleanPhotos only keeps our own /uploads URLs and caps the count', () => {
  const out = cleanPhotos([{ url: 'https://evil/x.png' }, { url: '/uploads/a.png' }, { url: '/uploads/../etc/passwd' }, { url: '/uploads/b.jpg' }, { url: '/uploads/c.jpg' }, { url: '/uploads/d.jpg' }]);
  assert.deepEqual(out.map((p) => p.url), ['/uploads/a.png', '/uploads/b.jpg', '/uploads/c.jpg']);
  assert.deepEqual(cleanPhotos('nope'), []);
});

test('cleanPhone strips letters and isEmail validates basic shape', () => {
  assert.equal(cleanPhone('+91 (98765) 43210 ext<script>'), '+91 (98765) 43210');
  assert.ok(isEmail('a@b.co'));
  assert.ok(!isEmail('a@b'));
  assert.ok(!isEmail('no spaces@x.com'));
});
