const supabase = require('../config/supabaseClient');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const { buildHistory } = require('../services/statsService');
const { closeIfExpired } = require('../services/sessionService');

// Never select face_embedding or password_hash for lists.
const MEMBER_COLS = 'id, roll_number, full_name, email, domain, year, github_handle, role, is_removed, created_at';

// The session the dashboard should show: the open one, else the most recent.
async function currentSession() {
  const act = unwrap(await supabase.from('sessions').select('id, title, status, starts_at, ends_at').eq('status', 'ACTIVE').limit(1), 'Could not load sessions');
  if (act[0]) {
    const s = await closeIfExpired(act[0]);
    if (s.status === 'ACTIVE') return s;
  }
  const last = unwrap(await supabase.from('sessions').select('id, title, status, starts_at, ends_at').in('status', ['CLOSED']).order('starts_at', { ascending: false }).limit(1), 'Could not load sessions');
  return last[0] || null;
}

// GET /api/admin/dashboard
const dashboard = async (req, res) => {
  const session = await currentSession();
  const members = unwrap(await supabase.from('members').select('id, roll_number, full_name, domain').eq('is_removed', false).eq('role', 'member').order('roll_number'), 'Could not load members');
  let att = [];
  if (session) att = unwrap(await supabase.from('attendance').select('member_id, status').eq('session_id', session.id), 'Could not load attendance');
  const byMember = new Map(att.map((a) => [a.member_id, a.status]));

  const rows = members.map((m) => {
    const st = byMember.get(m.id);
    return { ...m, status: st === 'PRESENT' ? 'Present' : st === 'PENDING_REVIEW' ? 'Pending' : session && session.status === 'CLOSED' ? 'Absent' : 'Not marked' };
  });
  const c = (s) => rows.filter((r) => r.status === s).length;
  res.json({
    session,
    counts: { total_members: members.length, present: c('Present'), pending: c('Pending'), absent_or_unmarked: members.length - c('Present') - c('Pending') },
    members: rows,
  });
};

// GET /api/admin/members?search=&domain=&year=
const listMembers = async (req, res) => {
  const all = unwrap(await supabase.from('members').select(MEMBER_COLS).order('roll_number'), 'Could not load members');
  const flags = unwrap(await supabase.from('flags').select('member_id').eq('active', true), 'Could not load flags');
  const flagCount = new Map();
  flags.forEach((f) => flagCount.set(f.member_id, (flagCount.get(f.member_id) || 0) + 1));
  const session = await currentSession();
  let att = [];
  if (session) att = unwrap(await supabase.from('attendance').select('member_id, status').eq('session_id', session.id), 'Could not load attendance');
  const byMember = new Map(att.map((a) => [a.member_id, a.status]));

  const q = String(req.query.search || '').toLowerCase().trim();
  const domain = String(req.query.domain || '').toLowerCase().trim();
  const year = String(req.query.year || '').toLowerCase().trim();

  const members = all
    .filter((m) => !q || m.full_name.toLowerCase().includes(q) || m.roll_number.includes(q) || (m.domain || '').toLowerCase().includes(q))
    .filter((m) => !domain || (m.domain || '').toLowerCase() === domain)
    .filter((m) => !year || (m.year || '').toLowerCase() === year)
    .map((m) => ({
      ...m,
      flag_count: flagCount.get(m.id) || 0,
      latest_status: byMember.get(m.id) === 'PRESENT' ? 'Present' : byMember.get(m.id) === 'PENDING_REVIEW' ? 'Pending' : session ? 'Absent' : null,
    }));

  res.json({
    stats: {
      total: all.length,
      active: all.filter((m) => !m.is_removed).length,
      flagged: flagCount.size,
      removed: all.filter((m) => m.is_removed).length,
    },
    members,
  });
};

const setRemoved = (value) => async (req, res) => {
  const { id } = req.valid.params;
  if (id === req.user.id) throw new AppError(400, 'You cannot remove yourself');
  const row = unwrap(await supabase.from('members').update({ is_removed: value }).eq('id', id).select('id').maybeSingle(), 'Could not update member');
  if (!row) throw new AppError(404, 'Member not found');
  res.json({ message: value ? 'Member removed' : 'Member restored' });
};

// POST /api/admin/members/:id/flag  and  /unflag
const flagMember = async (req, res) => {
  const { id } = req.valid.params;
  const m = unwrap(await supabase.from('members').select('id').eq('id', id).maybeSingle(), 'Could not load member');
  if (!m) throw new AppError(404, 'Member not found');
  unwrap(await supabase.from('flags').insert([{ member_id: id, reason: req.valid.body.reason, flagged_by: req.user.id }]), 'Could not flag member');
  res.status(201).json({ message: 'Member flagged' });
};
const unflagMember = async (req, res) => {
  const { id } = req.valid.params;
  unwrap(await supabase.from('flags').update({ active: false }).eq('member_id', id).eq('active', true), 'Could not unflag member');
  res.json({ message: 'Flags cleared' });
};
const listFlags = async (req, res) => {
  const data = unwrap(
    await supabase.from('flags').select('id, reason, created_at, members!flags_member_id_fkey(id, roll_number, full_name)').eq('active', true).order('created_at', { ascending: false }),
    'Could not load flags'
  );
  res.json({ flags: data });
};

// GET /api/admin/analytics
const analytics = async (req, res) => {
  const members = unwrap(await supabase.from('members').select('id, roll_number, full_name, domain, created_at').eq('is_removed', false).eq('role', 'member'), 'Could not load members');
  const sessions = unwrap(await supabase.from('sessions').select('id, title, status, starts_at, ends_at, created_at').in('status', ['ACTIVE', 'CLOSED']).order('starts_at', { ascending: false }).limit(500), 'Could not load sessions');
  const att = unwrap(await supabase.from('attendance').select('member_id, session_id, status, created_at').limit(20000), 'Could not load attendance');
  const attBy = new Map();
  att.forEach((a) => { if (!attBy.has(a.member_id)) attBy.set(a.member_id, []); attBy.get(a.member_id).push(a); });

  const perMember = members.map((m) => {
    const h = buildHistory(sessions, attBy.get(m.id) || [], m.created_at);
    return { id: m.id, roll_number: m.roll_number, full_name: m.full_name, domain: m.domain, percent: h.percent, present: h.present, total: h.total };
  });

  const byDomain = {};
  perMember.forEach((m) => {
    const d = byDomain[m.domain] || (byDomain[m.domain] = { domain: m.domain, members: 0, sum: 0 });
    d.members += 1; d.sum += m.percent;
  });
  const domainTurnout = Object.values(byDomain).map((d) => ({ domain: d.domain, members: d.members, average_percent: Math.round((d.sum / d.members) * 10) / 10 }));
  const avg = perMember.length ? Math.round((perMember.reduce((a, m) => a + m.percent, 0) / perMember.length) * 10) / 10 : 0;

  res.json({
    average_attendance_percent: avg,
    total_sessions: sessions.length,
    domain_turnout: domainTurnout,
    at_risk: perMember.filter((m) => m.total > 0 && m.percent < 50).sort((a, b) => a.percent - b.percent),
  });
};

// Events
const createEvent = async (req, res) => {
  const b = req.valid.body;
  const e = unwrap(await supabase.from('events').insert([{ title: b.title, description: b.description || null, event_date: b.event_date, created_by: req.user.id }]).select('id, title, description, event_date').single(), 'Could not create event');
  res.status(201).json({ event: e });
};
const deleteEvent = async (req, res) => {
  const row = unwrap(await supabase.from('events').delete().eq('id', req.valid.params.id).select('id').maybeSingle(), 'Could not delete event');
  if (!row) throw new AppError(404, 'Event not found');
  res.json({ message: 'Event deleted' });
};

// Alerts / review queue
const listAlerts = async (req, res) => {
  const reviewed = req.query.reviewed === 'true';
  const data = unwrap(
    await supabase.from('spoof_alerts')
      .select('id, reason, match_score, details, reviewed, attendance_id, created_at, members(roll_number, full_name), sessions(title)')
      .eq('reviewed', reviewed).order('created_at', { ascending: false }).limit(100),
    'Could not load alerts'
  );
  res.json({ alerts: data });
};
const getAlert = async (req, res) => {
  const a = unwrap(await supabase.from('spoof_alerts').select('id, reason, match_score, details, reviewed, attendance_id, created_at, image_base64, members(roll_number, full_name)').eq('id', req.valid.params.id).maybeSingle(), 'Could not load alert');
  if (!a) throw new AppError(404, 'Alert not found');
  res.json({ alert: a });
};
const reviewAlert = async (req, res) => {
  const { id } = req.valid.params;
  const { decision } = req.valid.body;
  const a = unwrap(await supabase.from('spoof_alerts').select('id, attendance_id, reviewed').eq('id', id).maybeSingle(), 'Could not load alert');
  if (!a) throw new AppError(404, 'Alert not found');
  if (a.reviewed) throw new AppError(409, 'Already reviewed');
  if (a.attendance_id) {
    unwrap(await supabase.from('attendance').update({ status: decision === 'approve' ? 'PRESENT' : 'REJECTED' }).eq('id', a.attendance_id), 'Could not update attendance');
  }
  unwrap(await supabase.from('spoof_alerts').update({ reviewed: true }).eq('id', id), 'Could not update alert');
  res.json({ message: decision === 'approve' ? 'Attendance approved' : 'Attendance rejected' });
};

const listProjects = async (req, res) => {
  const data = unwrap(await supabase.from('projects').select('id, title, repo_url, description, submitted_at, members(roll_number, full_name, domain)').order('submitted_at', { ascending: false }).limit(200), 'Could not load projects');
  res.json({ projects: data });
};

module.exports = {
  dashboard, listMembers, removeMember: setRemoved(true), restoreMember: setRemoved(false),
  flagMember, unflagMember, listFlags, analytics, createEvent, deleteEvent,
  listAlerts, getAlert, reviewAlert, listProjects,
};
