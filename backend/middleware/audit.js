const { getSharedDb } = require('../db/connection');
const { getAuditLogModel } = require('../models/AuditLog');

/**
 * Records an action after the response has been sent.
 *
 * Deliberately fire-and-forget: an audit write must never delay a response or turn
 * a working request into a failed one. Failures are logged to the console only.
 *
 * @param {string} action  stable identifier, e.g. 'groups.clear-all'
 * @param {(req, res) => object} [detailsFn]  small, PII-free summary of the target
 */
const audit = (action, detailsFn) => (req, res, next) => {
  res.on('finish', () => {
    let details = {};
    try {
      details = typeof detailsFn === 'function' ? (detailsFn(req, res) || {}) : {};
    } catch (error) {
      details = { detailsError: error.message };
    }

    const entry = {
      actorId: req.user?.id || null,
      actorUsername: req.user?.username || 'anonymous',
      actorRole: req.user?.role || 'unknown',
      action,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      year: String(req.year || ''),
      statusCode: res.statusCode,
      success: res.statusCode < 400,
      details,
      // Trust-proxy is enabled, so req.ip is the real client address on Render.
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    };

    Promise.resolve()
      .then(() => getAuditLogModel(getSharedDb()).create(entry))
      .catch((error) => console.error('[audit] failed to record', action, '-', error.message));
  });

  next();
};

module.exports = { audit };
