const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const make = (windowMs, limit, message, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    ...(keyGenerator ? { keyGenerator } : {}),
  });

const ipKey = (req) => ipKeyGenerator(req.ip);

// Check-in: keyed by the logged-in member (NOT by IP: the whole lab shares one campus IP).
const checkInLimiter = make(5 * 60 * 1000, 10, 'Too many check-in attempts. Wait a few minutes.', (req) => req.user?.id || ipKey(req));
// Login: keyed by IP + student number, so one wrong guess on one account does not lock others.
const loginLimiter = make(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.', (req) => `${ipKey(req)}:${req.body?.roll_number || ''}`);
const otpLimiter = make(15 * 60 * 1000, 8, 'Too many attempts. Try again in 15 minutes.', (req) => `${ipKey(req)}:${req.body?.roll_number || ''}`);
const registerLimiter = make(60 * 60 * 1000, 20, 'Too many registrations from this network. Try later.', ipKey);
const apiLimiter = make(15 * 60 * 1000, 1500, 'Too many requests. Slow down.', ipKey);

module.exports = { checkInLimiter, loginLimiter, otpLimiter, registerLimiter, apiLimiter };
