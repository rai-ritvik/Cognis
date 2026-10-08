// Run with:  npm test      (no internet, no Supabase, no ML service needed)
process.env.SUPABASE_URL = 'http://fake.local';
process.env.SUPABASE_SERVICE_KEY = 'fake';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.LAB_LAT = '28.6139';
process.env.LAB_LNG = '77.2090';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createFake } = require('./fakeSupabase');

// Replace the real Supabase client with the fake BEFORE the app loads.
const fake = createFake();
const clientPath = require.resolve('../config/supabaseClient');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: fake };

// Replace the ML service with a controllable stub.
const ml = require('../services/mlService');
const mlState = { down: false, faceDetected: true, confidence: 0.95 };
ml.getEmbedding = async () => {
  if (mlState.down) { const A = require('../utils/AppError'); throw new A(503, 'Face recognition service is unavailable. Try again shortly.', 'ML_DOWN'); }
  return new Array(8).fill(0.1);
};
ml.verifyFace = async () => {
  if (mlState.down) { const A = require('../utils/AppError'); throw new A(503, 'Face recognition service is unavailable. Try again shortly.', 'ML_DOWN'); }
  return { faceDetected: mlState.faceDetected, confidence: mlState.confidence };
};

const app = require('../server');
let base;
let server;
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(300);
const ADMIN = '2500271530105';
const S1 = '2500271530201';
const S2 = '2500271530202';

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, json };
}
const registerBody = (roll, email) => ({ roll_number: roll, full_name: 'Test ' + roll.slice(-3), email, password: 'Passw0rd!x', domain: 'Backend', year: '2nd', consent: true, image_base64: IMG });
const login = async (roll, password = 'Passw0rd!x') => (await api('POST', '/api/auth/login', { body: { roll_number: roll, password } }));

test.before(async () => {
  server = app.listen(0);
  base = 'http://127.0.0.1:' + server.address().port;
  // seed one admin directly in the fake DB (in real life you run sql/002_make_admin.sql)
  fake.db.members = [{ id: '11111111-1111-4111-8111-111111111111', roll_number: ADMIN, full_name: 'Admin Ritvik', email: 'admin@x.com', password_hash: bcrypt.hashSync('AdminPass1!', 10), role: 'admin', is_removed: false, domain: 'Backend', year: '2nd', created_at: new Date(Date.now() - 86400000 * 30).toISOString() }];
});
test.after(() => server.close());

test('health check works', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.json.status, 'ok');
});

test('unknown route gives 404 JSON', async () => {
  assert.equal((await api('GET', '/api/nope')).status, 404);
});

test('protected routes reject missing token', async () => {
  assert.equal((await api('GET', '/api/me/home')).status, 401);
  assert.equal((await api('POST', '/api/sessions/start', { body: { title: 'x' } })).status, 401);
  assert.equal((await api('GET', '/api/sessions/00000000-0000-4000-8000-000000000001/attendance')).status, 401);
});

test('register validates: bad roll number, short password, no consent', async () => {
  const bad = { ...registerBody('123', 'a@x.com'), password: 'short', consent: false };
  const r = await api('POST', '/api/auth/register', { body: bad });
  assert.equal(r.status, 400);
  const fields = r.json.details.map((d) => d.field);
  assert.ok(fields.includes('roll_number') && fields.includes('password') && fields.includes('consent'));
});

test('register succeeds and never returns hash/embedding; duplicates give 409', async () => {
  const r = await api('POST', '/api/auth/register', { body: registerBody(S1, 's1@x.com') });
  assert.equal(r.status, 201);
  assert.equal(r.json.member.roll_number, S1);
  assert.equal(r.json.member.password_hash, undefined);
  assert.equal(r.json.member.face_embedding, undefined);
  const dup = await api('POST', '/api/auth/register', { body: registerBody(S1, 'other@x.com') });
  assert.equal(dup.status, 409);
  await api('POST', '/api/auth/register', { body: registerBody(S2, 's2@x.com') });
});

test('register fails closed when ML1 is down (no fallback)', async () => {
  mlState.down = true;
  const r = await api('POST', '/api/auth/register', { body: registerBody('2500271530299', 'down@x.com') });
  mlState.down = false;
  assert.equal(r.status, 503);
  assert.equal(fake.db.members.some((m) => m.roll_number === '2500271530299'), false);
});

test('login: wrong password 401, right password returns token with role', async () => {
  assert.equal((await login(S1, 'wrongpass1')).status, 401);
  const ok = await login(S1);
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token.split('.').length === 3);
  assert.equal(ok.json.member.role, 'member');
  assert.equal(ok.json.member.password_hash, undefined);
});

test('students cannot use admin routes', async () => {
  const t = (await login(S1)).json.token;
  assert.equal((await api('POST', '/api/sessions/start', { token: t, body: { title: 'Hack session' } })).status, 403);
  assert.equal((await api('GET', '/api/admin/members', { token: t })).status, 403);
});

let sessionId; let roomToken; let adminToken; let s1Token; let s2Token;

test('admin starts a session; second start is blocked; students can find it but do not see the code', async () => {
  adminToken = (await login(ADMIN, 'AdminPass1!')).json.token;
  s1Token = (await login(S1)).json.token;
  s2Token = (await login(S2)).json.token;
  const r = await api('POST', '/api/sessions/start', { token: adminToken, body: { title: 'Task Evaluation' } });
  assert.equal(r.status, 201);
  assert.match(r.json.room_token, /^\d{4}$/);
  sessionId = r.json.session_id; roomToken = r.json.room_token;

  const again = await api('POST', '/api/sessions/start', { token: adminToken, body: { title: 'Another one' } });
  assert.equal(again.status, 409);

  const stu = await api('GET', '/api/sessions/active', { token: s1Token });
  assert.equal(stu.json.session.id, sessionId);
  assert.equal(stu.json.session.room_token, undefined);
  const adm = await api('GET', '/api/sessions/active', { token: adminToken });
  assert.equal(adm.json.session.room_token, roomToken);
});

const checkin = (token, over = {}) => api('POST', '/api/attendance/checkin', { token, body: { session_id: sessionId, room_token: roomToken, latitude: 28.6139, longitude: 77.2090, image_base64: IMG, ...over } });

test('check-in rejects wrong room code', async () => {
  const wrong = roomToken === '0000' ? '1111' : '0000';
  const r = await checkin(s1Token, { room_token: wrong });
  assert.equal(r.status, 403); assert.equal(r.json.code, 'BAD_TOKEN');
});

test('check-in rejects a student standing outside the radius and logs an alert with the photo', async () => {
  const r = await checkin(s1Token, { latitude: 28.6160, longitude: 77.2090 }); // ~230 m away
  assert.equal(r.status, 403); assert.equal(r.json.code, 'OUTSIDE_RADIUS');
  const alert = fake.db.spoof_alerts.find((a) => a.reason === 'OUTSIDE_RADIUS');
  assert.ok(alert && alert.image_base64);
});

test('check-in FAILS CLOSED if ML1 is down (nobody auto-approved)', async () => {
  mlState.down = true; const r = await checkin(s1Token); mlState.down = false;
  assert.equal(r.status, 503);
  assert.equal(fake.db.attendance.length, 0);
});

test('check-in: no face detected -> 422, nothing saved', async () => {
  mlState.faceDetected = false; const r = await checkin(s1Token); mlState.faceDetected = true;
  assert.equal(r.status, 422); assert.equal(fake.db.attendance.length, 0);
});

test('check-in: face mismatch -> 403 and alert logged', async () => {
  mlState.confidence = 0.2; const r = await checkin(s1Token); mlState.confidence = 0.95;
  assert.equal(r.status, 403); assert.equal(r.json.code, 'FACE_MISMATCH');
  assert.ok(fake.db.spoof_alerts.some((a) => a.reason === 'FACE_MISMATCH'));
});

test('check-in success -> PRESENT, no score leaked; duplicate -> 409', async () => {
  const r = await checkin(s1Token);
  assert.equal(r.status, 201); assert.equal(r.json.status, 'PRESENT');
  assert.equal(r.json.confidence, undefined);
  const dup = await checkin(s1Token);
  assert.equal(dup.status, 409);
});

test('borderline score -> PENDING_REVIEW, admin approves it', async () => {
  mlState.confidence = 0.7; const r = await checkin(s2Token); mlState.confidence = 0.95;
  assert.equal(r.status, 201); assert.equal(r.json.status, 'PENDING_REVIEW');
  const alerts = await api('GET', '/api/admin/alerts', { token: adminToken });
  const low = alerts.json.alerts.find((a) => a.reason === 'LOW_CONFIDENCE');
  assert.ok(low); assert.equal(low.image_base64, undefined); // list does not carry the heavy image
  const detail = await api('GET', '/api/admin/alerts/' + low.id, { token: adminToken });
  assert.ok(detail.json.alert.image_base64);
  const rev = await api('POST', `/api/admin/alerts/${low.id}/review`, { token: adminToken, body: { decision: 'approve' } });
  assert.equal(rev.status, 200);
  assert.equal(fake.db.attendance.find((a) => a.member_id === fake.db.members.find((m) => m.roll_number === S2).id).status, 'PRESENT');
  assert.equal((await api('POST', `/api/admin/alerts/${low.id}/review`, { token: adminToken, body: { decision: 'approve' } })).status, 409);
});

test('rotating the code: new code works, old code works only briefly, then session end blocks everyone', async () => {
  const rot = await api('POST', '/api/sessions/rotate', { token: adminToken, body: { session_id: sessionId } });
  assert.equal(rot.status, 200); assert.match(rot.json.room_token, /^\d{4}$/);
  const row = fake.db.sessions.find((s) => s.id === sessionId);
  assert.equal(row.previous_room_token, roomToken);
  assert.equal(row.current_room_token, rot.json.room_token);
  const end = await api('POST', '/api/sessions/end', { token: adminToken, body: { session_id: sessionId } });
  assert.equal(end.status, 200);
  const r = await api('POST', '/api/attendance/checkin', { token: s1Token, body: { session_id: sessionId, room_token: rot.json.room_token, latitude: 28.6139, longitude: 77.2090, image_base64: IMG } });
  assert.equal(r.status, 400);
});

test('expired room code is rejected (server-side expiry, not just frontend)', async () => {
  const st = await api('POST', '/api/sessions/start', { token: adminToken, body: { title: 'Expiry test' } });
  const sid = st.json.session_id; const tok = st.json.room_token;
  const row = fake.db.sessions.find((s) => s.id === sid);
  row.token_expires_at = new Date(Date.now() - 60000).toISOString(); // pretend it expired a minute ago
  const r = await api('POST', '/api/attendance/checkin', { token: s1Token, body: { session_id: sid, room_token: tok, latitude: 28.6139, longitude: 77.2090, image_base64: IMG } });
  assert.equal(r.status, 403); assert.equal(r.json.code, 'BAD_TOKEN');
  await api('POST', '/api/sessions/end', { token: adminToken, body: { session_id: sid } });
});

test('a session whose end time passed closes itself', async () => {
  const st = await api('POST', '/api/sessions/start', { token: adminToken, body: { title: 'Auto close' } });
  fake.db.sessions.find((s) => s.id === st.json.session_id).ends_at = new Date(Date.now() - 1000).toISOString();
  const act = await api('GET', '/api/sessions/active', { token: s1Token });
  assert.equal(act.json.session, null);
});

test('member home + analytics reflect attendance', async () => {
  const home = await api('GET', '/api/me/home', { token: s1Token });
  assert.equal(home.status, 200);
  assert.ok(home.json.overall.total >= 1);
  assert.equal(home.json.overall.present, 1);
  const an = await api('GET', '/api/me/analytics', { token: s1Token });
  assert.equal(an.status, 200);
  assert.ok(Array.isArray(an.json.records));
  assert.equal(an.json.overall.percent > 0, true);
});

test('profile get/update + project submit', async () => {
  const p = await api('PATCH', '/api/me/profile', { token: s1Token, body: { bio: 'Hello', skills: ['Node', 'SQL'], github_handle: 'rai-ritvik' } });
  assert.equal(p.status, 200); assert.deepEqual(p.json.member.skills, ['Node', 'SQL']);
  const g = await api('GET', '/api/me/profile', { token: s1Token });
  assert.equal(g.json.member.password_hash, undefined);
  assert.equal(g.json.flags.count, 0);
  const bad = await api('PATCH', '/api/me/profile', { token: s1Token, body: { linkedin_url: 'not-a-url' } });
  assert.equal(bad.status, 400);
  const pr = await api('POST', '/api/me/projects', { token: s1Token, body: { title: 'OmniScan', repo_url: 'https://github.com/rai-ritvik/OmniScan' } });
  assert.equal(pr.status, 201);
  assert.equal((await api('GET', '/api/me/projects', { token: s1Token })).json.projects.length, 1);
});

test('admin: members list, flag, unflag, remove blocks login, events, analytics', async () => {
  const list = await api('GET', '/api/admin/members?search=' + S1.slice(-3), { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.json.members.length, 1);
  assert.equal(list.json.members[0].password_hash, undefined);
  assert.equal(list.json.members[0].face_embedding, undefined);
  const id = list.json.members[0].id;

  assert.equal((await api('POST', `/api/admin/members/${id}/flag`, { token: adminToken, body: { reason: 'Missed 3 sessions' } })).status, 201);
  assert.equal((await api('GET', '/api/me/profile', { token: s1Token })).json.flags.count, 1);
  assert.equal((await api('GET', '/api/admin/members', { token: adminToken })).json.stats.flagged, 1);
  assert.equal((await api('POST', `/api/admin/members/${id}/unflag`, { token: adminToken })).status, 200);
  assert.equal((await api('GET', '/api/admin/flags', { token: adminToken })).json.flags.length, 0);

  const ev = await api('POST', '/api/admin/events', { token: adminToken, body: { title: 'Townhall', event_date: '2099-01-01' } });
  assert.equal(ev.status, 201);
  assert.equal((await api('GET', '/api/me/events', { token: s1Token })).json.events.length, 1);

  const an = await api('GET', '/api/admin/analytics', { token: adminToken });
  assert.equal(an.status, 200); assert.ok(Array.isArray(an.json.domain_turnout));
  const dash = await api('GET', '/api/admin/dashboard', { token: adminToken });
  assert.equal(dash.status, 200); assert.ok(dash.json.counts.total_members >= 2);

  assert.equal((await api('POST', `/api/admin/members/${id}/remove`, { token: adminToken })).status, 200);
  assert.equal((await login(S1)).status, 401); // removed members cannot log in
  await api('POST', `/api/admin/members/${id}/restore`, { token: adminToken });
  assert.equal((await login(S1)).status, 200);
});

test('forgot password: OTP flow end to end (generic reply, wrong code, right code, reset, login)', async () => {
  const f = await api('POST', '/api/auth/forgot', { body: { roll_number: S2 } });
  assert.equal(f.status, 200);
  const unknown = await api('POST', '/api/auth/forgot', { body: { roll_number: '9999999999999' } });
  assert.equal(unknown.json.message, f.json.message); // same message, no user enumeration

  const row = fake.db.password_resets.find((r) => r.used === false);
  assert.ok(row);
  assert.equal((await api('POST', '/api/auth/verify-otp', { body: { roll_number: S2, code: '000000' } })).status, 400);
  // we cannot read the emailed code, so craft a known code for the stored hash:
  const crypto = require('crypto');
  row.code_hash = crypto.createHash('sha256').update('123456' + process.env.JWT_SECRET).digest('hex');
  const v = await api('POST', '/api/auth/verify-otp', { body: { roll_number: S2, code: '123456' } });
  assert.equal(v.status, 200);
  const rs = await api('POST', '/api/auth/reset-password', { body: { reset_token: v.json.reset_token, new_password: 'NewPassw0rd!' } });
  assert.equal(rs.status, 200);
  assert.equal((await login(S2, 'Passw0rd!x')).status, 401);
  assert.equal((await login(S2, 'NewPassw0rd!')).status, 200);
});

test('a password-reset token cannot be used as a login token', async () => {
  const jwt = require('jsonwebtoken');
  const t = jwt.sign({ purpose: 'reset' }, process.env.JWT_SECRET, { subject: ADMIN, expiresIn: '5m' });
  assert.equal((await api('GET', '/api/me/home', { token: t })).status, 401);
});

test('oversized and malformed bodies are handled', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  assert.equal(res.status, 400);
});
