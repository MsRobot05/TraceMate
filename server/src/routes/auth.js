import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { adminEmails } from '../config.js';
import { isEmail, str, cleanPhone } from '../utils/validate.js';

const router = Router();

// Brute-force protection: only FAILED attempts (status >= 400) count towards the limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_FAIL_LIMIT || 20),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many failed attempts. Please wait 15 minutes and try again.' }
});

const session = (user) => ({ token: signToken(user), user: user.toClient() });

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const name = str(req.body.name, 80);
  const email = str(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2) return res.status(400).json({ message: 'Please enter your full name (at least 2 characters).' });
  if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be between 10 and 128 characters.' });
  }
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'An account with this email already exists. Try signing in.' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: adminEmails().includes(email) ? 'admin' : 'student'
  });
  res.status(201).json(session(user));
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password so accounts cannot be enumerated.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }
  // Promote configured admins on sign-in so ADMIN_EMAILS works for accounts created earlier.
  if (adminEmails().includes(user.email) && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }
  res.json(session(user));
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) return res.status(401).json({ message: 'Account no longer exists. Please sign in again.' });
  res.json({ user: user.toClient() });
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) return res.status(401).json({ message: 'Account no longer exists. Please sign in again.' });

  if (req.body.name !== undefined) {
    const name = str(req.body.name, 80);
    if (name.length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters.' });
    user.name = name;
  }
  if (req.body.phone !== undefined) {
    const phone = cleanPhone(req.body.phone);
    if (phone && phone.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ message: 'Phone number looks too short.' });
    }
    user.phone = phone;
  }
  if (req.body.program !== undefined) user.program = str(req.body.program, 100);
  if (req.body.year !== undefined) user.year = str(req.body.year, 30);
  if (req.body.bio !== undefined) user.bio = str(req.body.bio, 240);
  if (req.body.campus !== undefined) user.campus = str(req.body.campus, 100);

  await user.save();
  res.json({ user: user.toClient() });
});

export default router;
