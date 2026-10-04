const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { connectToMongo } = require('./db/connection');
const { authRequired, requireYearAccess } = require('./middleware/auth');
const { enforceYearLock } = require('./middleware/locks');
const { loginLimiter, apiLimiter } = require('./middleware/rateLimit');
const {
  sanitizeServerErrors,
  notFoundHandler,
  errorHandler,
} = require('./middleware/errorHandler');

const internshipRoutes = require('./routes/internships');
const uploadRoutes = require('./routes/upload');
const analyticsRoutes = require('./routes/analytics');
const groupRoutes = require('./routes/groups');
const mentorEditRoutes = require('./routes/mentor-edit');
const sendMailRoutes = require('./routes/send-mail');
const mentorRoutes = require('./routes/mentors');
const mailDraftRoutes = require('./routes/mail-draft');
const senderEmailsRoutes = require('./routes/sender-emails');
const evaluationSettingsRoutes = require('./routes/evaluation-settings');
const authRoutes = require('./routes/auth');
const yearSettingsRoutes = require('./routes/year-settings');
const auditLogRoutes = require('./routes/audit-logs');

// Load .env from root directory or backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}

// Validate mail credentials secret early (used for encrypting/decrypting sender email passwords)
if (!process.env.MAIL_CREDENTIALS_SECRET && !process.env.ENCRYPTION_SECRET) {
  throw new Error('MAIL_CREDENTIALS_SECRET not configured');
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET not configured');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Render terminates TLS at its proxy. Without this, express-rate-limit sees every
// request as coming from the same proxy IP and req.secure is always false.
app.set('trust proxy', 1);

// This API is consumed by a separate SPA origin and never renders HTML itself,
// so the restrictive default CSP is safe here.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Fail fast when MongoDB is unavailable (prevents 10s buffering timeouts)
mongoose.set('bufferCommands', false);

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'https://internship-portal-seven-tau.vercel.app',
    normalizeOrigin(process.env.FRONTEND_URL),
    ...String(process.env.FRONTEND_URLS || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
  ].filter(Boolean)
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Lock-Override-Reason: an admin's reason for changing locked data (see middleware/locks.js).
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Lock-Override-Reason'],
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Bulk import posts parsed spreadsheet rows as JSON and is legitimately large.
// Every other endpoint handles a form or a login, which is a few KB at most —
// keeping the global ceiling low removes a trivial memory-exhaustion vector.
app.use('/api/upload', express.json({ limit: '25mb' }));
app.use('/api/upload', express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Redacts 5xx messages in production so driver/schema internals never reach a browser.
app.use(sanitizeServerErrors);

// Root health check for Render and uptime monitors
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SPIT Internship Portal Backend Running Successfully',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// MongoDB connection - Atlas only
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI (or MONGO_URI) not found in environment variables');
  console.error('Please set MONGODB_URI in your .env file');
  process.exit(1);
}

connectToMongo(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected');
});

// Health check — deliberately registered before the rate limit, database and auth
// gates so uptime monitors can still reach it when the database is unavailable.
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'OK' : 'DEGRADED',
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Routes
app.use('/api', apiLimiter);

// If DB isn't connected, return a clear error quickly (keeps UI responsive)
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Check MongoDB connection/DNS/network.'
    });
  }
  next();
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// Everything past this point requires a valid token, and the academic year in that
// token must be one the account is actually permitted to open.
app.use('/api', authRequired);
app.use('/api', requireYearAccess);
// A locked (finished) year is read-only: staff are refused, admins must give a reason.
app.use('/api', enforceYearLock);

app.use('/api/internships', internshipRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/mentor', mentorEditRoutes);
app.use('/api/send-mail', sendMailRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/mail-draft', mailDraftRoutes);
app.use('/api/sender-emails', senderEmailsRoutes);
app.use('/api/evaluation-settings', evaluationSettingsRoutes);
app.use('/api/year-settings', yearSettingsRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Unmatched API routes return JSON, never stray HTML.
app.use('/api', notFoundHandler);

// Must stay last: converts anything thrown in a route into a safe JSON response.
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Without these, one rejected promise anywhere can take the whole process down
// silently and Render just restarts it with no explanation in the logs.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  server.close(() => process.exit(1));
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  // Don't hang forever if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

