const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new AppError(401, 'Authentication required'));

  try {
    const decoded = jwt.verify(match[1], env.jwtSecret);
    if (!decoded.sub || decoded.purpose === 'reset') {
      throw new Error('Invalid access token');
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      roll: decoded.roll
    };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError(403, 'Admin access required'));
  }
  next();
}

module.exports = { verifyToken, requireAdmin };
