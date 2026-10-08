/**
 * Strips personal data from text before it is written to server logs.
 *
 * Render keeps logs outside our control, so student and examiner email addresses
 * must never land there, not even inside a database or SMTP error message
 * (e.g. MongoDB's "E11000 duplicate key ... { email: \"a@b.c\" }").
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const redact = (value) => String(value ?? '').replace(EMAIL, '<email>');

module.exports = { redact };
