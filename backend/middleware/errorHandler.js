const AppError = require('../utils/AppError');

const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Image/request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

module.exports = { notFound, errorHandler };
