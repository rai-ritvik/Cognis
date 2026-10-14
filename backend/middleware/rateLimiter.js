const { rateLimit } = require('express-rate-limit');

function makeLimiter(limit, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
  });
}

const apiLimiter = makeLimiter(5000);
const loginLimiter = makeLimiter(10);
const otpLimiter = makeLimiter(5);
const registerLimiter = makeLimiter(1000);
const checkInLimiter = makeLimiter(10);

module.exports = {
  apiLimiter,
  loginLimiter,
  otpLimiter,
  registerLimiter,
  checkInLimiter
};
