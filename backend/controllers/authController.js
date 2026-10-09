const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const ml = require('../services/mlService');
const { sendOtp } = require('../services/mailService');

// Used so a wrong student number takes the same time as a wrong password (no user-guessing by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const hashCode = (code) => crypto.createHash('sha256').update(code + env.jwtSecret).digest('hex');

const signLogin = (m) => jwt.sign({ role: m.role, roll: m.roll_number }, env.jwtSecret, { subject: m.id, expiresIn: env.jwtExpiry });

// POST /api/auth/register
const register = async (req, res) => {
  const b = req.valid.body;
  const embedding = await ml.getEmbedding(b.roll_number, b.full_name, b.frames); // fails closed if enrollment/liveness service is unavailable
  const password_hash = await bcrypt.hash(b.password, 10);

  const { data, error } = await supabase
    .from('members')
    .insert([{
      roll_number: b.roll_number,
      full_name: b.full_name,
      email: b.email,
      password_hash,
      domain: b.domain,
      year: b.year,
      github_handle: b.github_handle || null,
      face_embedding: embedding,
      consent_at: new Date().toISOString(),
    }])
    .select('id, roll_number, full_name, domain, year, role')
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'This student number or email is already registered');
    console.error('[register]', error.message);
    throw new AppError(500, 'Could not create account');
  }
  res.status(201).json({ member: data });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { roll_number, password } = req.valid.body;
  const { data: m } = await supabase
    .from('members')
    .select('id, roll_number, full_name, role, password_hash, is_removed')
    .eq('roll_number', roll_number)
    .maybeSingle();

  const ok = await bcrypt.compare(password, m?.password_hash || DUMMY_HASH);
  if (!m || !ok || m.is_removed) throw new AppError(401, 'Invalid student number or password');

  res.json({
    token: signLogin(m),
    member: { id: m.id, roll_number: m.roll_number, full_name: m.full_name, role: m.role },
  });
};

// POST /api/auth/forgot  -> emails a 6-digit code (valid 2 minutes)
const forgotPassword = async (req, res) => {
  const { roll_number } = req.valid.body;
  const { data: m } = await supabase.from('members').select('id, email, is_removed').eq('roll_number', roll_number).maybeSingle();

  if (m && m.email && !m.is_removed) {
    const code = String(crypto.randomInt(100000, 1000000));
    await supabase.from('password_resets').update({ used: true }).eq('member_id', m.id).eq('used', false); // kill older codes
    unwrap(
      await supabase.from('password_resets').insert([{ member_id: m.id, code_hash: hashCode(code), expires_at: new Date(Date.now() + 120000).toISOString() }]),
      'Could not create reset code'
    );
    await sendOtp(m.email, code);
  }
  // Same answer whether or not the account exists (so attackers cannot find valid student numbers).
  res.json({ message: 'If the account exists, a code has been sent to the registered email.', expires_in_seconds: 120 });
};

// POST /api/auth/verify-otp -> returns a short-lived reset_token
const verifyOtp = async (req, res) => {
  const { roll_number, code } = req.valid.body;
  const bad = new AppError(400, 'Invalid or expired code');

  const { data: m } = await supabase.from('members').select('id').eq('roll_number', roll_number).maybeSingle();
  if (!m) throw bad;

  const { data: r } = await supabase
    .from('password_resets')
    .select('id, code_hash, attempts, expires_at')
    .eq('member_id', m.id)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!r || new Date(r.expires_at) <= new Date() || r.attempts >= 5) throw bad;

  const a = Buffer.from(hashCode(code));
  const b = Buffer.from(r.code_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await supabase.from('password_resets').update({ attempts: r.attempts + 1 }).eq('id', r.id);
    throw bad;
  }

  await supabase.from('password_resets').update({ used: true }).eq('id', r.id);
  const reset_token = jwt.sign({ purpose: 'reset' }, env.jwtSecret, { subject: m.id, expiresIn: '10m' });
  res.json({ reset_token });
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { reset_token, new_password } = req.valid.body;
  let decoded;
  try {
    decoded = jwt.verify(reset_token, env.jwtSecret);
    if (decoded.purpose !== 'reset') throw new Error('wrong token type');
  } catch (e) {
    throw new AppError(400, 'Reset link expired. Start again.');
  }
  const password_hash = await bcrypt.hash(new_password, 10);
  unwrap(await supabase.from('members').update({ password_hash }).eq('id', decoded.sub), 'Could not update password');
  res.json({ message: 'Password updated. You can log in now.' });
};

module.exports = { register, login, forgotPassword, verifyOtp, resetPassword };
