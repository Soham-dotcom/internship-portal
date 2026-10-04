/**
 * Centralised error handling.
 *
 * Goal: never leak Mongoose/driver internals (schema field names, index names,
 * connection strings) to a browser, while keeping the full detail in server logs.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

/** An error whose message is safe to show a user. */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

const badRequest = (msg) => new ApiError(400, msg);
const notFound = (msg) => new ApiError(404, msg);
const conflict = (msg) => new ApiError(409, msg);
const forbidden = (msg) => new ApiError(403, msg);

/**
 * Transitional safety net.
 *
 * Most routes still build their own `res.status(500).json({ message: error.message })`
 * responses inline. Rewriting all of them at once is risky, so this wraps res.json and
 * redacts the message on 5xx responses in production, logging the original server-side.
 *
 * Remove this once every route routes its errors through `next(err)`.
 */
const sanitizeServerErrors = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && body.message) {
      console.error('[5xx]', req.method, req.originalUrl, '-', body.message);
      if (isProduction()) {
        return originalJson({
          ...body,
          message: 'Something went wrong on our side. Please try again.',
        });
      }
    }
    return originalJson(body);
  };

  next();
};

/** 404 for unmatched /api routes, so the SPA never receives stray HTML. */
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/** Final error handler. Must be registered last, and must keep all four arguments. */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;

  // Known, user-safe errors pass their message through.
  if (err.expose || status < 500) {
    return res.status(status).json({ success: false, message: err.message });
  }

  console.error('[error]', req.method, req.originalUrl, '-', err.stack || err.message);

  return res.status(500).json({
    success: false,
    message: isProduction()
      ? 'Something went wrong on our side. Please try again.'
      : err.message,
  });
};

module.exports = {
  ApiError,
  badRequest,
  notFound,
  conflict,
  forbidden,
  sanitizeServerErrors,
  notFoundHandler,
  errorHandler,
};
