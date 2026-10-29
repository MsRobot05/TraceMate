import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { UPLOAD_DIR } from './config.js';
import itemRoutes from './routes/items.js';
import authRoutes from './routes/auth.js';
import claimRoutes from './routes/claims.js';
import aiRoutes from './routes/ai.js';
import uploadRoutes from './routes/uploads.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is required and must be at least 32 characters. Copy server/.env.example to server/.env and set a private secret.');
  process.exit(1);
}

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security headers. Uploaded images are loaded by the React app on a different origin, so allow that.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '1d' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ai: process.env.GEMINI_API_KEY ? 'gemini-optional-enabled' : 'local-fallback',
    uptimeSeconds: Math.round(process.uptime())
  });
});

// Generous global limit protects every endpoint from simple floods (login has its own stricter limiter).
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' }
}));

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

// Central error handler. express-async-errors forwards errors from async routes here,
// so a bad ID or database hiccup returns JSON instead of crashing the server.
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid value supplied.' });
  if (error.code === 11000) return res.status(409).json({ message: 'A duplicate record was detected.' });
  const status = error.status || error.statusCode;
  if (status && status < 500) return res.status(status).json({ message: status === 404 ? 'Not found.' : 'Request could not be processed.' });
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const port = process.env.PORT || 5000;

try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tracemate', {
    serverSelectionTimeoutMS: 8000
  });
  console.log('MongoDB connected');
  app.listen(port, () => console.log(`TraceMate API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Could not connect to MongoDB. Check server/.env.', error.message);
  process.exit(1);
}
