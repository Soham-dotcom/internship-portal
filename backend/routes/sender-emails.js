const express = require('express');
const { getSharedDb } = require('../db/connection');
const { getSenderEmailModel } = require('../models/SenderEmail');
const { encryptString } = require('../utils/crypto');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
}

// GET /api/sender-emails
router.get('/', async (req, res) => {
  try {
    const SenderEmail = getSenderEmailModel(getSharedDb());
    const senders = await SenderEmail.find().sort({ email: 1 }).select('email createdAt updatedAt');
    return res.json({
      success: true,
      data: senders,
      count: senders.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/sender-emails
router.post('/', async (req, res) => {
  try {
    const SenderEmail = getSenderEmailModel(getSharedDb());
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    if (!password || String(password).length < 4) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await SenderEmail.exists({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Sender email already exists' });
    }

    const encrypted = encryptString(password);

    const sender = await SenderEmail.create({
      email: normalizedEmail,
      passwordEncrypted: encrypted,
    });

    return res.json({
      success: true,
      message: 'Sender email saved',
      data: {
        _id: sender._id,
        email: sender.email,
        createdAt: sender.createdAt,
        updatedAt: sender.updatedAt,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;
