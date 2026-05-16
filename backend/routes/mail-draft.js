const express = require('express');
const { getYearDb } = require('../db/connection');
const { getMailDraftModel } = require('../models/MailDraft');

const router = express.Router();

const DEFAULT_SUBJECT = 'Student Group Details';
const DEFAULT_BODY = `Dear Mentor,\n\nPlease find attached the list of students assigned to your group.\n\nRegards,\nAdministrator`;

// GET /api/mail-draft
router.get('/', async (req, res) => {
  try {
    console.log('📨 [mail-draft] API HIT GET /api/mail-draft');
    const MailDraft = getMailDraftModel(getYearDb(req.year));
    const draft = await MailDraft.findOne({ key: 'global' }).select('subject body updatedAt');
    if (!draft) {
      return res.json({
        success: true,
        data: { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
        isDefault: true,
      });
    }

    return res.json({
      success: true,
      data: { subject: draft.subject, body: draft.body, updatedAt: draft.updatedAt },
      isDefault: false,
    });
  } catch (error) {
    console.error('❌ [mail-draft] Error loading draft:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mail-draft
router.post('/', async (req, res) => {
  try {
    const { subject, body } = req.body;

    const MailDraft = getMailDraftModel(getYearDb(req.year));

    console.log('📨 [mail-draft] API HIT POST /api/mail-draft');
    console.log('📦 [mail-draft] Body:', JSON.stringify({
      subject: subject ? String(subject).slice(0, 120) : subject,
      bodyPreview: body ? String(body).slice(0, 120) : body,
    }, null, 2));

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Body is required' });
    }

    const draft = await MailDraft.findOneAndUpdate(
      { key: 'global' },
      { $set: { subject: String(subject).trim(), body: String(body) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('subject body updatedAt');

    console.log('✅ [mail-draft] Saved', { updatedAt: draft.updatedAt });

    return res.json({
      success: true,
      message: 'Mail draft saved',
      data: { subject: draft.subject, body: draft.body, updatedAt: draft.updatedAt },
    });
  } catch (error) {
    console.error('❌ [mail-draft] Error saving draft:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
