// Seeds demo data so the app looks alive for a demo/viva.  Usage: npm run seed   (from server/ or project root)
// Safe to re-run: it removes previously seeded demo accounts (and their reports/claims/notifications) first.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Item from '../src/models/Item.js';
import Claim from '../src/models/Claim.js';
import Notification from '../src/models/Notification.js';
import AgentTask from '../src/models/AgentTask.js';

const PASSWORD = 'DemoPass#2026';
const DOMAIN = '@seed.tracemate.test';
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tracemate', { serverSelectionTimeoutMS: 8000 });

const old = await User.find({ email: new RegExp(`${DOMAIN.replace('.', '\\.')}$`) }).select('_id');
const oldIds = old.map((u) => u._id);
const oldItems = await Item.find({ owner: { $in: oldIds } }).select('_id');
await Claim.deleteMany({ $or: [{ claimant: { $in: oldIds } }, { item: { $in: oldItems.map((i) => i._id) } }] });
await Item.deleteMany({ owner: { $in: oldIds } });
await Notification.deleteMany({ user: { $in: oldIds } });
await AgentTask.deleteMany({ owner: { $in: oldIds } });
await User.deleteMany({ _id: { $in: oldIds } });

const hash = await bcrypt.hash(PASSWORD, 10);
const [asha, rohan, meera, admin] = await User.create([
  { name: 'Asha Kulkarni', email: `asha${DOMAIN}`, passwordHash: hash, program: 'MCA', year: '1st year', phone: '+91 98765 11111' },
  { name: 'Rohan Deshmukh', email: `rohan${DOMAIN}`, passwordHash: hash, program: 'B.Tech CSE', year: '3rd year', phone: '+91 98765 22222' },
  { name: 'Meera Joshi', email: `meera${DOMAIN}`, passwordHash: hash, program: 'BBA', year: '2nd year', phone: '+91 98765 33333' },
  { name: 'Campus Moderator', email: `admin${DOMAIN}`, passwordHash: hash, role: 'admin', program: 'Student Affairs' }
]);

const mk = (owner, o) => ({ owner, contactName: owner.name, contactEmail: owner.email, contactPhone: owner.phone || '', statusHistory: [{ status: 'open', by: owner._id, note: 'Report created' }], ...o });

const items = await Item.create([
  mk(asha, { type: 'lost', category: 'Electronics', title: 'Black wireless headphones', description: 'Black over-ear wireless headphones with a small scratch on the left cup.', location: 'MIT-WPU Library', date: daysAgo(2) }),
  mk(rohan, { type: 'found', category: 'Electronics', title: 'Black over-ear headphones', description: 'Black over-ear headphones found on a reading table near the window.', location: 'MIT-WPU Library', date: daysAgo(1) }),
  mk(meera, { type: 'lost', category: 'Personal items', title: 'Blue insulated water bottle', description: 'Navy blue steel water bottle with a dent near the bottom and a white lid.', location: 'Sports Ground', date: daysAgo(4) }),
  mk(asha, { type: 'found', category: 'Personal items', title: 'Blue steel water bottle', description: 'Blue steel bottle with a white lid left on a bench beside the ground.', location: 'Sports Ground', date: daysAgo(3), safeMeetingPoint: 'Campus security / reception' }),
  mk(rohan, { type: 'lost', category: 'Stationery', title: 'Blue lecture notebook', description: 'Blue ruled notebook with handwritten Data Structures notes.', location: 'Academic Block', date: daysAgo(8) }),
  mk(meera, { type: 'found', category: 'Keys', title: 'Bunch of three keys', description: 'Three keys on a red ring with a small plastic tag.', location: 'MIT-WPU Main Gate', date: daysAgo(1) }),
  mk(asha, { type: 'lost', category: 'Accessories', title: 'Black card holder', description: 'Black leather card holder with a missing ID card inside.', location: 'Canteen / Food Court', date: daysAgo(6) }),
  mk(rohan, { type: 'found', category: 'Clothing', title: 'Grey hoodie', description: 'Grey zip hoodie with a small logo on the chest, left on a chair.', location: 'Auditorium', date: daysAgo(5) }),
  mk(meera, { type: 'lost', category: 'Electronics', title: 'Scientific calculator', description: 'Casio scientific calculator with initials scratched on the back.', location: 'Academic Block', date: daysAgo(10), status: 'returned' })
]);

// A pending claim (so the owner has something to review) and a completed one (recovery story).
const bottle = items[3];
await Claim.create({ item: bottle._id, claimant: meera._id, message: 'This looks like my bottle, I lost it on Monday after sports practice.', privateProof: 'There is a sticker of a fox inside the lid.', history: [{ status: 'pending', by: meera._id, note: 'Claim submitted' }] });
bottle.status = 'claim-pending';
await bottle.save();

const calc = items[8];
await Claim.create({ item: calc._id, claimant: rohan._id, status: 'completed', message: 'I found this calculator in Block B.', history: [{ status: 'pending', by: rohan._id }, { status: 'approved', by: meera._id }, { status: 'completed', by: meera._id, note: 'Handed over at the library desk' }] });

await Notification.create([
  { user: asha._id, type: 'claim-received', title: 'New claim on your report', body: 'Someone submitted a claim on “Blue steel water bottle”. Review their private proof under My activity.', link: '/my' },
  { user: asha._id, type: 'possible-match', title: 'Possible match for your report', body: 'A new found report “Black over-ear headphones” looks 90% similar to “Black wireless headphones”.', link: '/reports' }
]);

console.log(`\nSeeded ${items.length} reports, 2 claims and 4 demo accounts.\n`);
console.log('Demo logins (password for all: ' + PASSWORD + ')');
console.log(`  student : asha${DOMAIN}   (has a claim to review + a match alert)`);
console.log(`  student : rohan${DOMAIN}`);
console.log(`  student : meera${DOMAIN}  (has a pending claim)`);
console.log(`  admin   : admin${DOMAIN}  (moderation dashboard at /admin)\n`);
await mongoose.disconnect();
