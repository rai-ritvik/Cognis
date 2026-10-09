const supabase = require('../config/supabaseClient');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const ml = require('../services/mlService');
const { isTokenValid } = require('../services/roomToken');
const { closeIfExpired } = require('../services/sessionService');

// Saves a failed / suspicious attempt (with the photo) so admins can review it. Never blocks the response.
async function logAlert({ memberId, sessionId, reason, score = null, details = null, image = null, attendanceId = null }) {
  try {
    await supabase.from('spoof_alerts').insert([{
      member_id: memberId, session_id: sessionId, reason, failed_checks: [reason],
      match_score: score, details, image_base64: image, attendance_id: attendanceId,
    }]);
  } catch (e) {
    console.error('[alert] could not log alert:', e.message);
  }
}

// POST /api/attendance/checkin   (student, logged in)
// Order is cheapest -> most expensive: session -> duplicate -> room code -> location -> face
const checkIn = async (req, res) => {
  const { session_id, room_token, latitude, longitude, frames } = req.valid.body;
  const memberId = req.user.id; // identity comes from the login token, NEVER from the request body

  let session = unwrap(
    await supabase.from('sessions')
      .select('id, status, ends_at, current_room_token, token_expires_at, previous_room_token, previous_valid_until')
      .eq('id', session_id).maybeSingle(),
    'Could not load session'
  );
  if (!session) throw new AppError(404, 'Session not found');
  session = await closeIfExpired(session);
  if (session.status !== 'ACTIVE') throw new AppError(400, 'Attendance is not open for this session', 'SESSION_CLOSED');

  const member = unwrap(
    await supabase.from('members').select('id, face_embedding, is_removed').eq('id', memberId).maybeSingle(),
    'Could not load member'
  );
  if (!member || member.is_removed) throw new AppError(403, 'Your account is not active');

  const existing = unwrap(
    await supabase.from('attendance').select('id, status').eq('session_id', session_id).eq('member_id', memberId).maybeSingle(),
    'Could not check existing attendance'
  );
  if (existing) throw new AppError(409, 'You have already checked in for this session', 'ALREADY_CHECKED_IN');

  if (!isTokenValid(session, room_token)) {
    throw new AppError(403, 'Invalid or expired room code. Check the projector.', 'BAD_TOKEN');
  }

  // Location: PostGIS function in the database (see sql/001_v2_schema.sql)
  const geo = await supabase.rpc('verify_location', { session_id_param: session_id, student_lat: latitude, student_lon: longitude });
  if (geo.error) {
    console.error('[checkin] verify_location failed:', geo.error.message);
    throw new AppError(500, 'Could not verify location');
  }
  const g = Array.isArray(geo.data) ? geo.data[0] : geo.data;
  if (!g || !g.is_within_radius) {
    await logAlert({
      memberId, sessionId: session_id, reason: 'OUTSIDE_RADIUS', image: frames[0],
      details: `distance_m=${g && g.distance_meters != null ? Math.round(g.distance_meters) : 'unknown'}`,
    });
    throw new AppError(403, 'You are outside the allowed lab area.', 'OUTSIDE_RADIUS');
  }

  // ML service checks multi-frame identity + blink/liveness. If it is down,
  // ml.verifyFace throws and attendance is never approved (fail closed).
  const verification = await ml.verifyFace(frames, member.face_embedding);
  const confidence = verification.similarity;

  if (!verification.livenessPassed) {
    await logAlert({ memberId, sessionId: session_id, reason: 'LIVENESS_FAILED', score: confidence, image: frames[0], details: verification.reason || 'Liveness challenge failed' });
    throw new AppError(403, 'Liveness check failed. Please capture a live camera sequence and try again.', 'LIVENESS_FAILED');
  }

  if (!verification.verified) {
    await logAlert({ memberId, sessionId: session_id, reason: 'FACE_MISMATCH', score: confidence, image: frames[0], details: verification.reason || 'ML identity verification failed' });
    throw new AppError(403, 'Your face could not be verified against the registered face.', 'FACE_MISMATCH');
  }

  // Only an ML-approved identity AND passed liveness can become attendance.
  // The local auto threshold is for manual-review triage, not a replacement
  // for the ML service's identity/liveness decision.
  const status = confidence >= env.autoThreshold ? 'PRESENT' : 'PENDING_REVIEW';
  const { data: row, error } = await supabase
    .from('attendance')
    .insert([{ session_id, member_id: memberId, status, match_score: confidence }])
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new AppError(409, 'You have already checked in for this session', 'ALREADY_CHECKED_IN');
    console.error('[checkin] insert failed:', error.message);
    throw new AppError(500, 'Could not save attendance');
  }

  if (status === 'PENDING_REVIEW') {
    await logAlert({ memberId, sessionId: session_id, reason: 'LOW_CONFIDENCE', score: confidence, image: frames[0], attendanceId: row.id });
  }

  // We do not send the match score back (it would help someone tune an attack).
  res.status(201).json({
    status,
    message: status === 'PRESENT' ? 'Attendance marked successfully!' : 'Check-in received. An admin will confirm it shortly.',
  });
};

module.exports = { checkIn };
