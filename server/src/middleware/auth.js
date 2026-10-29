import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/** Rejects the request with 401 unless a valid JWT is supplied. Sets req.user = { sub, role }. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }
}

/** Like requireAuth but anonymous visitors are allowed (req.user stays undefined). */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      /* treat an invalid token as anonymous for public routes */
    }
  }
  next();
}

/** Admin check reads the role from MongoDB (not the token) so demotions take effect immediately. */
export async function requireAdmin(req, res, next) {
  const user = await User.findById(req.user.sub).select('role');
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access is required.' });
  }
  next();
}
