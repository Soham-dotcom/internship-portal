const express = require('express');
const nodemailer = require('nodemailer');
const xlsx = require('xlsx');

const { getSharedDb, getYearDb } = require('../db/connection');
const { getGroupModel } = require('../models/Group');
const { getMailDraftModel } = require('../models/MailDraft');
const { getSenderEmailModel } = require('../models/SenderEmail');
const { decryptString } = require('../utils/crypto');
const { audit } = require('../middleware/audit');

const router = express.Router();

function createTransporter({ user, pass } = {}) {
  const {
    SMTP_SERVICE,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_CONNECTION_TIMEOUT_MS,
  } = process.env;

  const authUser = user || SMTP_USER;
  const authPass = pass || SMTP_PASS;

  if (!authUser || !authPass) {
    const error = new Error('SMTP_USER/SMTP_PASS not configured');
    error.statusCode = 500;
    throw error;
  }

  if (SMTP_SERVICE) {
    return nodemailer.createTransport({
      service: SMTP_SERVICE,
      auth: {
        user: authUser,
        pass: authPass,
      },
      connectionTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
      greetingTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
      socketTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
    });
  }

  // If caller provided credentials (e.g., Gmail App Password stored in DB) and no SMTP
  // settings are configured, default to Gmail for a working out-of-the-box setup.
  if (user && pass && !SMTP_HOST && !SMTP_PORT) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: authUser,
        pass: authPass,
      },
      connectionTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
      greetingTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
      socketTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
    });
  }

  if (!SMTP_HOST || !SMTP_PORT) {
    const error = new Error('SMTP_HOST/SMTP_PORT not configured (or set SMTP_SERVICE)');
    error.statusCode = 500;
    throw error;
  }

  const port = Number(SMTP_PORT);
  const secure = String(SMTP_SECURE).toLowerCase() === 'true';

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: authUser,
      pass: authPass,
    },
    connectionTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
    greetingTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
    socketTimeout: Number(SMTP_CONNECTION_TIMEOUT_MS) || 20000,
  });
}

function normalizeMailError(error) {
  if (!error) return error;

  // Nodemailer uses EAUTH for bad credentials.
  if (error.code === 'EAUTH') {
    const e = new Error(
      'SMTP authentication failed. If you are using Gmail, you must use a Gmail App Password (not your normal password).'
    );
    e.statusCode = 400;
    e.original = { code: error.code, response: error.response };
    return e;
  }

  return error;
}

function buildGroupExcelBuffer(group) {
  const internalMentorName = group.internalMentor?.name || 'Not Assigned';
  const externalMentorName = group.externalMentor?.name || 'Not Assigned';
  const externalMentorEmail = group.externalMentor?.email || '';
  const externalMentorPhone = group.externalMentor?.phone || '';

  // Keep the sheet aligned with existing export conventions.
  const sheetData = (group.students || []).map((student) => ({
    'Student Name': student.name || '',
    'UID': student.uid || '',
    'Branch': student.branch || '',
    'Institute Email': student.email || '',
    'Student Phone': student.phone || '',
    'Internal Mentor Name': internalMentorName,
    'External Mentor Name': externalMentorName,
    'External Mentor Email': externalMentorEmail,
    'External Mentor Phone': externalMentorPhone,
  }));

  const ws = xlsx.utils.json_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 15 },
    { wch: 30 },
    { wch: 15 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 18 },
  ];

  const wb = xlsx.utils.book_new();
  const sheetName = (group.name || 'Group').substring(0, 31);
  xlsx.utils.book_append_sheet(wb, ws, sheetName);

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function getGlobalDraft(MailDraft) {
  const draft = await MailDraft.findOne({ key: 'global' }).select('subject body evaluationLink');
  if (draft) return { subject: draft.subject, body: draft.body, evaluationLink: draft.evaluationLink || '' };

  return {
    subject: 'Student Group Details',
    body: `Dear Mentor,\n\nPlease find attached the list of students assigned to your group.\n\nRegards,\nAdministrator`,
    evaluationLink: '',
  };
}

function applyPlaceholders(text, ctx) {
  const safe = String(text ?? '');
  return safe
    .replace(/\{\{\s*mentorName\s*\}\}/gi, ctx.mentorName || '')
    .replace(/\{\{\s*mentorEmail\s*\}\}/gi, ctx.mentorEmail || '')
    .replace(/\{\{\s*groupName\s*\}\}/gi, ctx.groupName || '');
}

async function resolveSenderAuth(SenderEmail, senderEmailId) {
  // If no sender is selected, fall back to env-based SMTP.
  if (!senderEmailId) return null;

  const sender = await SenderEmail.findById(senderEmailId).select('email passwordEncrypted');
  if (!sender) {
    const error = new Error('Sender email not found');
    error.statusCode = 404;
    throw error;
  }

  const decryptedPassword = decryptString(sender.passwordEncrypted);
  return {
    email: sender.email,
    user: sender.email,
    pass: decryptedPassword,
  };
}

async function sendGroupMail(models, { groupId, recipientType, senderEmailId, evaluationLink: overrideEvaluationLink }) {
  const { Group, MailDraft, SenderEmail } = models;
  console.log('📨 [send-mail] Preparing mail', { groupId, recipientType, senderEmailId: senderEmailId || null });
  const group = await Group.findById(groupId)
    .populate('externalMentor', 'name email phone')
    .populate('internalMentor', 'name email phone')
    .populate('students', 'uid name branch companyName email phone');

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const type = recipientType === 'internal' || recipientType === 'external' ? recipientType : null;
  const fallbackType = group.externalMentor ? 'external' : 'internal';
  const effectiveType = type || fallbackType;

  const mentor = effectiveType === 'external' ? group.externalMentor : group.internalMentor;
  const recipientEmail = mentor?.email;
  const recipientName = mentor?.name || 'Mentor';

  if (!recipientEmail) {
    const error = new Error(`Selected ${effectiveType} mentor email is missing for this group`);
    error.statusCode = 400;
    throw error;
  }

  if (!group.students || group.students.length === 0) {
    const error = new Error('This group has no students to send');
    error.statusCode = 400;
    throw error;
  }

  const excelBuffer = buildGroupExcelBuffer(group);

  const senderAuth = await resolveSenderAuth(SenderEmail, senderEmailId);
  const transporter = createTransporter(senderAuth || undefined);

  const draft = await getGlobalDraft(MailDraft);

  const ctx = {
    mentorName: recipientName,
    mentorEmail: recipientEmail,
    groupName: group.name,
  };

  const subject = applyPlaceholders(draft.subject, ctx);
  const bodyPlain = applyPlaceholders(draft.body, ctx);

  // Determine evaluation link precedence: API-provided override > draft stored link
  const evaluationLink = overrideEvaluationLink || draft.evaluationLink || '';

  // Simple HTML-safe escape for the body (treat draft.body as plain text)
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const bodyEscaped = escapeHtml(bodyPlain).replace(/\n/g, '<br>');

  // Append clickable evaluation link if present
  let htmlBody = bodyEscaped;
  let textBody = bodyPlain;
  if (evaluationLink) {
    const safeLink = escapeHtml(evaluationLink);
    htmlBody = `${bodyEscaped}<br><br>Evaluation Sheet: <a href="${safeLink}" target="_blank" rel="noopener noreferrer">Click here to open the evaluation sheet</a>`;
    textBody = `${bodyPlain}\n\nEvaluation Sheet: ${evaluationLink}`;
  }

  const fromEmail = senderAuth?.email || process.env.MAIL_FROM || process.env.SMTP_USER;
  const fileName = `${(group.name || 'Group').replace(/\s+/g, '_')}_students.xlsx`;

  console.log('📤 [send-mail] Sending email', {
    from: fromEmail,
    to: recipientEmail,
    subject,
    recipientType: effectiveType,
    attachment: fileName,
    students: group.students?.length || 0,
  });

  await transporter.sendMail({
    from: fromEmail,
    to: recipientEmail,
    subject,
    text: textBody,
    html: htmlBody,
    attachments: [
      {
        filename: fileName,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });

  console.log('✅ [send-mail] Email sent successfully', { to: recipientEmail, groupId: String(group._id) });

  group.mailSent = true;
  group.mailSentAt = new Date();
  await group.save();

  return {
    recipientName,
    recipientEmail,
    group,
    effectiveType,
  };
}

// POST /api/send-mail  (body: { groupId, recipientType, senderEmailId })
router.post('/', audit('mail.send-group', (req) => ({
  groupId: req.body?.groupId,
  recipientType: req.body?.recipientType,
})), async (req, res) => {
  try {
    const { groupId, recipientType, senderEmailId, evaluationLink } = req.body;

    const yearDb = getYearDb(req.year);
    const models = {
      Group: getGroupModel(yearDb),
      MailDraft: getMailDraftModel(yearDb),
      SenderEmail: getSenderEmailModel(getSharedDb()),
    };

    console.log('🚀 [send-mail] API HIT POST /api/send-mail');
    console.log('📦 [send-mail] Body:', JSON.stringify({ groupId, recipientType, senderEmailId }, null, 2));

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'groupId is required' });
    }

    const result = await sendGroupMail(models, { groupId, recipientType, senderEmailId, evaluationLink });

    return res.json({
      success: true,
      message: `Mail sent to ${result.recipientName} <${result.recipientEmail}>`,
      data: {
        groupId: result.group._id,
        mailSent: true,
        mailSentAt: result.group.mailSentAt,
        recipientType: result.effectiveType,
      },
    });
  } catch (error) {
    const normalized = normalizeMailError(error);
    console.error('❌ [send-mail] Error:', normalized);
    const status = normalized.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: normalized.message || 'Error sending mail',
      data: normalized.data,
    });
  }
});

// POST /api/send-mail/:groupId (backwards compatible; accepts optional body)
router.post('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { recipientType, senderEmailId, evaluationLink } = req.body || {};

    const yearDb = getYearDb(req.year);
    const models = {
      Group: getGroupModel(yearDb),
      MailDraft: getMailDraftModel(yearDb),
      SenderEmail: getSenderEmailModel(getSharedDb()),
    };

    console.log('🚀 [send-mail] API HIT POST /api/send-mail/:groupId', { groupId });
    console.log('📦 [send-mail] Body:', JSON.stringify({ recipientType, senderEmailId }, null, 2));

    const result = await sendGroupMail(models, { groupId, recipientType, senderEmailId, evaluationLink });

    return res.json({
      success: true,
      message: `Mail sent to ${result.recipientName} <${result.recipientEmail}>`,
      data: {
        groupId: result.group._id,
        mailSent: true,
        mailSentAt: result.group.mailSentAt,
        recipientType: result.effectiveType,
      },
    });
  } catch (error) {
    const normalized = normalizeMailError(error);
    console.error('❌ [send-mail] Error:', normalized);
    const status = normalized.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: normalized.message || 'Error sending mail',
      data: normalized.data,
    });
  }
});

module.exports = router;
