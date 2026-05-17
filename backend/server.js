const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectToMongo } = require('./db/connection');
const { authRequired } = require('./middleware/auth');

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

// Fail fast when MongoDB is unavailable (prevents 10s buffering timeouts)
mongoose.set('bufferCommands', false);

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const allowedOrigins = new Set(
  [
    'http://localhost:3000',
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
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Increased limit for bulk imports
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Routes
// If DB isn't connected, return a clear error quickly (keeps UI responsive)
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Check MongoDB connection/DNS/network.'
    });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', authRequired);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

