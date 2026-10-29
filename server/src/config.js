import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Uploads live in server/uploads regardless of where `node` was started from. */
export const UPLOAD_DIR = path.resolve(here, '../uploads');

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const CATEGORIES = ['Electronics', 'Stationery', 'Personal items', 'Accessories', 'Keys', 'Clothing', 'Other'];
export const ITEM_STATUSES = ['open', 'matched', 'claim-pending', 'claimed', 'returned'];
