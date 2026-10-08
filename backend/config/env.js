require('dotenv').config();

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error('Missing required env vars: ' + missing.join(', ') + ' (see .env.example)');
}

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

module.exports = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: '8h',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),

  // ML1 (face match) service
  ml1Url: process.env.ML1_URL || 'http://localhost:8001',
  autoThreshold: num(process.env.MATCH_AUTO_THRESHOLD, 0.8),   // >= this  -> PRESENT
  reviewThreshold: num(process.env.MATCH_REVIEW_THRESHOLD, 0.6), // >= this  -> PENDING_REVIEW, below -> rejected

  // Room code
  tokenTtlSeconds: num(process.env.ROOM_TOKEN_TTL_SECONDS, 30),
  tokenGraceSeconds: 5,

  // The lab (all meetings happen here). Used when the admin does not send coordinates.
  labLat: process.env.LAB_LAT ? Number(process.env.LAB_LAT) : null,
  labLng: process.env.LAB_LNG ? Number(process.env.LAB_LNG) : null,
  defaultRadiusM: num(process.env.LAB_RADIUS_M, 15),

  // Email (for the forgot-password OTP)
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@netra.local',
  },
};
