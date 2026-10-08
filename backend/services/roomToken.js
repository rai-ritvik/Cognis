const crypto = require('crypto');
const env = require('../config/env');

const newToken = () => String(crypto.randomInt(0, 10000)).padStart(4, '0'); // cryptographically random, e.g. "0427"

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

const inSeconds = (s) => new Date(Date.now() + s * 1000).toISOString();

// The code on the projector changes every ~30s. We accept:
//  - the current code (until its expiry + a small grace), or
//  - the previous code for a few seconds after rotation (so a student typing during the switch is not punished)
function isTokenValid(session, supplied, now = Date.now()) {
  const grace = env.tokenGraceSeconds * 1000;
  const current =
    session.current_room_token &&
    session.token_expires_at &&
    safeEqual(supplied, session.current_room_token) &&
    now <= new Date(session.token_expires_at).getTime() + grace;
  const previous =
    session.previous_room_token &&
    session.previous_valid_until &&
    safeEqual(supplied, session.previous_room_token) &&
    now <= new Date(session.previous_valid_until).getTime();
  return Boolean(current || previous);
}

module.exports = { newToken, isTokenValid, inSeconds };
