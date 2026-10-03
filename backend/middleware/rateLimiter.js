const rateLimit = require('express-rate-limit');

const checkInLimiter = rateLimit({
    winsowMs: 1 * 60 * 1000,
    max: 5,
    message: { error: "Too many check-in attempts. Please calm down and try again in 60 seconds." },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = (checkInLimiter);