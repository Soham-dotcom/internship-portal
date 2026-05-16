const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');
const { parseYears } = require('../config/years');

const router = express.Router();

router.get('/config', (req, res) => {
  const years = parseYears();
  res.json({ success: true, data: { years } });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, year } = req.body;
    if (!username || !password || !year) {
      return res.status(400).json({ success: false, message: 'Username, password, and year are required' });
    }

    const years = parseYears();
    if (!years.includes(String(year))) {
      return res.status(400).json({ success: false, message: 'Invalid year selection' });
    }

    const sharedDb = getSharedDb();
    const User = getUserModel(sharedDb);

    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    let passwordMatch = false;
    if (user.passwordHash) {
      passwordMatch = await bcrypt.compare(String(password), user.passwordHash);
    } else if (user.password) {
      passwordMatch = String(password) === String(user.password);
      if (passwordMatch) {
        const newHash = await bcrypt.hash(String(password), 10);
        user.passwordHash = newHash;
        await user.save();
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username, year: String(year) },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      data: {
        token,
        username: user.username,
        year: String(year)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
