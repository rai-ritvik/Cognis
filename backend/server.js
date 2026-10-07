const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const supabase = require('./config/supabaseClient');
const AppError = require('./utils/AppError');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
// On Render/Railway the app sits behind a proxy; this makes req.ip the real client IP (needed by rate limiting).
if (env.nodeEnv === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true); // no origin = Postman/Thunder Client/curl
    cb(new AppError(403, 'Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10mb' })); // selfies are base64 strings, so the default 100kb is too small
app.use(apiLimiter);

app.get('/api/health', async (req, res) => {
  const { error } = await supabase.from('sessions').select('id', { head: true, count: 'exact' }).limit(1);
  res.status(error ? 503 : 200).json({ status: error ? 'degraded' : 'ok', database: error ? 'unreachable' : 'ok', time: new Date() });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/me', require('./routes/meRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => console.log(`OmniScan backend running on port ${env.port} (${env.nodeEnv})`));
}
module.exports = app;
