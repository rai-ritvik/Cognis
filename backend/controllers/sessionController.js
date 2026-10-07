const supabase = require('../config/supabaseClient');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const { newToken, inSeconds } = require('../services/roomToken');
const { closeIfExpired, locationWkt } = require('../services/sessionService');

const coords = (b) => {
  const lat = b.latitude ?? env.labLat;
  const lng = b.longitude ?? env.labLng;
  if (lat == null || lng == null) throw new AppError(400, 'Send latitude and longitude (or set LAB_LAT / LAB_LNG on the server)');
  return { lat, lng };
};

// POST /api/sessions/schedule (admin) -> creates a SCHEDULED session (not open yet)
const scheduleSession = async (req, res) => {
  const b = req.valid.body;
  const { lat, lng } = coords(b);
  const data = unwrap(
    await supabase.from('sessions').insert([{
      title: b.title, status: 'SCHEDULED', starts_at: b.starts_at, ends_at: b.ends_at || null,
      radius_m: b.radius_m || env.defaultRadiusM, lab_location: locationWkt(lat, lng), started_by: req.user.id,
    }]).select('id, title, status, starts_at, ends_at').single(),
    'Could not schedule session'
  );
  res.status(201).json({ session: data });
};

// POST /api/sessions/start (admin) -> opens a NEW session, or opens an existing SCHEDULED one (send session_id)
const startSession = async (req, res) => {
  const b = req.valid.body;

  // Only one session may be open at a time. Close any that already expired first.
  const open = unwrap(await supabase.from('sessions').select('id, status, ends_at').eq('status', 'ACTIVE'), 'Could not check active sessions');
  for (const s of open) {
    const after = await closeIfExpired(s);
    if (after.status === 'ACTIVE') throw new AppError(409, 'A session is already active. End it first.', 'SESSION_ALREADY_ACTIVE');
  }

  const now = new Date();
  const ends = new Date(now.getTime() + (b.duration_minutes || 120) * 60000).toISOString();
  const live = {
    status: 'ACTIVE', starts_at: now.toISOString(), ends_at: ends,
    current_room_token: newToken(), token_expires_at: inSeconds(env.tokenTtlSeconds),
    previous_room_token: null, previous_valid_until: null, started_by: req.user.id,
  };

  let row;
  if (b.session_id) {
    row = unwrap(
      await supabase.from('sessions').update(live).eq('id', b.session_id).eq('status', 'SCHEDULED')
        .select('id, title, current_room_token, token_expires_at, ends_at').maybeSingle(),
      'Could not start session'
    );
    if (!row) throw new AppError(404, 'No scheduled session with that id');
  } else {
    if (!b.title) throw new AppError(400, 'title is required to start a new session');
    const { lat, lng } = coords(b);
    row = unwrap(
      await supabase.from('sessions').insert([{
        ...live, title: b.title, radius_m: b.radius_m || env.defaultRadiusM, lab_location: locationWkt(lat, lng),
      }]).select('id, title, current_room_token, token_expires_at, ends_at').single(),
      'Could not start session'
    );
  }
  res.status(201).json({
    session_id: row.id, title: row.title, room_token: row.current_room_token,
    token_expires_at: row.token_expires_at, ends_at: row.ends_at, token_ttl_seconds: env.tokenTtlSeconds,
  });
};

// POST /api/sessions/rotate (admin) -> new room code; the old one still works for a few seconds
const rotateToken = async (req, res) => {
  const { session_id } = req.valid.body;
  let s = unwrap(
    await supabase.from('sessions').select('id, status, ends_at, current_room_token').eq('id', session_id).maybeSingle(),
    'Could not load session'
  );
  if (!s) throw new AppError(404, 'Session not found');
  s = await closeIfExpired(s);
  if (s.status !== 'ACTIVE') throw new AppError(400, 'Session is not active', 'SESSION_CLOSED');

  const token = newToken();
  const expires = inSeconds(env.tokenTtlSeconds);
  unwrap(
    await supabase.from('sessions').update({
      previous_room_token: s.current_room_token,
      previous_valid_until: inSeconds(env.tokenGraceSeconds),
      current_room_token: token,
      token_expires_at: expires,
    }).eq('id', session_id).eq('status', 'ACTIVE'),
    'Could not rotate token'
  );
  res.json({ room_token: token, token_expires_at: expires, token_ttl_seconds: env.tokenTtlSeconds });
};

// POST /api/sessions/end (admin)
const endSession = async (req, res) => {
  const { session_id } = req.valid.body;
  const row = unwrap(
    await supabase.from('sessions').update({ status: 'CLOSED', current_room_token: null, previous_room_token: null })
      .eq('id', session_id).neq('status', 'CLOSED').select('id').maybeSingle(),
    'Could not end session'
  );
  if (!row) throw new AppError(404, 'Session not found or already closed');
  res.json({ message: 'Session closed. No more check-ins allowed.' });
};

// GET /api/sessions/active (any logged-in user)  -> students use this to find the session id; admins also get the room code
const getActive = async (req, res) => {
  const rows = unwrap(
    await supabase.from('sessions')
      .select('id, title, status, starts_at, ends_at, current_room_token, token_expires_at')
      .eq('status', 'ACTIVE').limit(1),
    'Could not load session'
  );
  let s = rows[0] ? await closeIfExpired(rows[0]) : null;
  if (!s || s.status !== 'ACTIVE') return res.json({ session: null });

  const out = { id: s.id, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at };
  if (req.user.role === 'admin') {
    out.room_token = s.current_room_token;
    out.token_expires_at = s.token_expires_at;
    out.token_ttl_seconds = env.tokenTtlSeconds;
  }
  res.json({ session: out });
};

// GET /api/sessions (admin) -> recent sessions
const listSessions = async (req, res) => {
  const data = unwrap(
    await supabase.from('sessions').select('id, title, status, starts_at, ends_at, radius_m')
      .order('created_at', { ascending: false }).limit(50),
    'Could not load sessions'
  );
  res.json({ sessions: data });
};

// GET /api/sessions/:id/attendance (admin)
const getSessionAttendance = async (req, res) => {
  const { id } = req.valid.params;
  const data = unwrap(
    await supabase.from('attendance')
      .select('id, status, match_score, created_at, members(roll_number, full_name, domain)')
      .eq('session_id', id).order('created_at', { ascending: true }),
    'Could not load attendance'
  );
  const students = data.map((r) => ({
    attendance_id: r.id, roll_number: r.members?.roll_number, full_name: r.members?.full_name,
    domain: r.members?.domain, status: r.status, match_score: r.match_score, time_logged: r.created_at,
  }));
  res.json({
    total_present: students.filter((s) => s.status === 'PRESENT').length,
    total_pending: students.filter((s) => s.status === 'PENDING_REVIEW').length,
    students,
  });
};

module.exports = { scheduleSession, startSession, rotateToken, endSession, getActive, listSessions, getSessionAttendance };
