const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// Checks the "Authorization: Bearer <token>" header and puts the user on req.user
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'Login required');
  try {
    const decoded = jwt.verify(header.slice(7), env.jwtSecret);
    if (decoded.purpose) throw new Error('not a login token'); // password-reset tokens cannot be used to log in
    req.user = { id: decoded.sub, role: decoded.role, roll: decoded.roll };
    next();
  } catch (e) {
    throw new AppError(401, 'Invalid or expired token');
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') throw new AppError(403, 'Admin access required');
  next();
};

module.exports = { verifyToken, requireAdmin };
