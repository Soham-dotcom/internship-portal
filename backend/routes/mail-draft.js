const express = require('express');
const { getYearDb } = require('../db/connection');
const { getMailDraftModel } = require('../models/MailDraft');
const { audit } = require('../middleware/audit');

const router = express.Router();

const DEFAULT_SUBJECT = 'Student Group Details';
const DEFAULT_BODY = `Dear Mentor,\n\nPlease find attached the list of students assigned to your group.\n\nRegards,\nAdministrator`;
const DEFAULT_EVALUATION_LINK = '';

// GET /api/mail-draft
router.get('/', async (req, res) => {
  try {
    console.log('📨 [mail-draft] API HIT GET /api/mail-draft');
    const MailDraft = getMailDraftModel(getYearDb(req.year));
    const draft = await MailDraft.findOne({ key: 'global' }).select('subject body evaluationLink updatedAt');
    if (!draft) {
      return res.json({
        success: true,
        data: { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, evaluationLink: DEFAULT_EVALUATION_LINK },
        isDefault: true,
      });
    }

    return res.json({
      success: true,
      data: { subject: draft.subject, body: draft.body, evaluationLink: draft.evaluationLink || DEFAULT_EVALUATION_LINK, updatedAt: draft.updatedAt },
      isDefault: false,
    });
  } catch (error) {
    console.error('❌ [mail-draft] Error loading draft:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mail-draft
router.post('/', audit('mail-draft.update', (req) => ({ subject: String(req.body?.subject || '').slice(0, 120) })), async (req, res) => {
  try {
    const { subject, body, evaluationLink } = req.body;

    const MailDraft = getMailDraftModel(getYearDb(req.year));

    console.log('📨 [mail-draft] API HIT POST /api/mail-draft');
    console.log('📦 [mail-draft] Body:', JSON.stringify({
      subject: subject ? String(subject).slice(0, 120) : subject,
      bodyPreview: body ? String(body).slice(0, 120) : body,
      evaluationLinkPreview: evaluationLink ? String(evaluationLink).slice(0, 120) : evaluationLink,
    }, null, 2));

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Body is required' });
    }

    // Validate evaluationLink if provided (basic URL validation)
    let validatedLink = '';
    if (evaluationLink && String(evaluationLink).trim()) {
      try {
        const u = new URL(String(evaluationLink).trim());
        validatedLink = u.toString();
      } catch (e) {
        return res.status(400).json({ success: false, message: 'evaluationLink must be a valid URL' });
      }
    }

    const draft = await MailDraft.findOneAndUpdate(
      { key: 'global' },
      { $set: { subject: String(subject).trim(), body: String(body), evaluationLink: validatedLink } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('subject body evaluationLink updatedAt');

    console.log('✅ [mail-draft] Saved', { updatedAt: draft.updatedAt });

    return res.json({
      success: true,
      message: 'Mail draft saved',
      data: { subject: draft.subject, body: draft.body, evaluationLink: draft.evaluationLink || '', updatedAt: draft.updatedAt },
    });
  } catch (error) {
    console.error('❌ [mail-draft] Error saving draft:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
