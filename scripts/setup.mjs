// One-time setup helper:  npm run setup
// Creates server/.env from the example and fills in a random JWT secret. Never overwrites an existing .env.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'server', '.env');
const example = path.join(root, 'server', '.env.example');

if (fs.existsSync(target)) {
  console.log('server/.env already exists - leaving it untouched.');
} else {
  const secret = crypto.randomBytes(48).toString('hex');
  const text = fs.readFileSync(example, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  fs.writeFileSync(target, text);
  console.log('Created server/.env with a fresh JWT secret.');
}
console.log('\nNext: make sure MongoDB is running (or set MONGODB_URI in server/.env to your Atlas string), then run:\n  npm run dev\n');
