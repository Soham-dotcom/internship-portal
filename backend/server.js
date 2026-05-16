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

// Temporary debug log (safe): confirms presence without printing secret.
console.log('[config] MAIL_CREDENTIALS_SECRET loaded:', !!process.env.MAIL_CREDENTIALS_SECRET);

const app = express();
const PORT = process.env.PORT || 5000;

// Fail fast when MongoDB is unavailable (prevents 10s buffering timeouts)
mongoose.set('bufferCommands', false);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for bulk imports
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection - Atlas only
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  console.error('Please set MONGODB_URI in your .env file');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

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
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

