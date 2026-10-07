const supabase = require('../config/supabaseClient');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const { buildHistory } = require('../services/statsService');
const { dayKey, monthKey } = require('../utils/time');

const PROFILE_COLS = 'id, roll_number, full_name, email, domain, year, github_handle, bio, skills, linkedin_url, instagram_url, role, created_at';

async function loadMember(id) {
  const m = unwrap(await supabase.from('members').select(PROFILE_COLS).eq('id', id).maybeSingle(), 'Could not load profile');
  if (!m) throw new AppError(404, 'Member not found');
  return m;
}

async function loadHistory(member) {
  const sessions = unwrap(
    await supabase.from('sessions').select('id, title, status, starts_at, ends_at, created_at')
      .in('status', ['ACTIVE', 'CLOSED']).order('starts_at', { ascending: false }).limit(500),
    'Could not load sessions'
  );
  const att = unwrap(
    await supabase.from('attendance').select('session_id, status, created_at').eq('member_id', member.id),
    'Could not load attendance'
  );
  return buildHistory(sessions, att, member.created_at);
}

async function upcomingEvents(limit = 10) {
  return unwrap(
    await supabase.from('events').select('id, title, description, event_date')
      .gte('event_date', dayKey(new Date())).order('event_date', { ascending: true }).limit(limit),
    'Could not load events'
  );
}

// GET /api/me/profile
const getProfile = async (req, res) => {
  const member = await loadMember(req.user.id);
  const flags = await supabase.from('flags').select('id, created_at', { count: 'exact' }).eq('member_id', member.id).eq('active', true).order('created_at', { ascending: false }).limit(1);
  res.json({
    member,
    flags: { count: flags.count || 0, latest_flag_date: flags.data && flags.data[0] ? flags.data[0].created_at : null },
  });
};

// PATCH /api/me/profile
const updateProfile = async (req, res) => {
  const changes = req.valid.body;
  if (Object.keys(changes).length === 0) throw new AppError(400, 'Nothing to update');
  const m = unwrap(
    await supabase.from('members').update(changes).eq('id', req.user.id).select(PROFILE_COLS).single(),
    'Could not update profile'
  );
  res.json({ member: m });
};

// GET /api/me/home  -> everything the member dashboard shows
const getHome = async (req, res) => {
  const member = await loadMember(req.user.id);
  const h = await loadHistory(member);
  const today = dayKey(new Date());
  const todays = h.rows.filter((r) => dayKey(r.starts_at) === today);
  const events = await upcomingEvents(5);

  res.json({
    name: member.full_name,
    overall: { percent: h.percent, present: h.present, total: h.total },
    today: { present: todays.filter((r) => r.status === 'Present').length, total: todays.length },
    upcoming_events: { count: events.length, items: events },
    recent: h.rows.slice(0, 5),
  });
};

// GET /api/me/analytics
const getAnalytics = async (req, res) => {
  const member = await loadMember(req.user.id);
  const h = await loadHistory(member);
  const thisMonth = monthKey(new Date());
  const monthRows = h.rows.filter((r) => monthKey(r.starts_at) === thisMonth && r.status !== 'Not marked');
  const lastAbsent = h.rows.find((r) => r.status === 'Absent');

  res.json({
    overall: { percent: h.percent, present: h.present, absent: h.absent, pending: h.pending, total: h.total },
    this_month: { attended: monthRows.filter((r) => r.status === 'Present').length, total: monthRows.length },
    records: h.rows,
    note: lastAbsent ? `You missed "${lastAbsent.title}" on ${dayKey(lastAbsent.starts_at)}. Make sure to catch up on what you missed.` : null,
  });
};

// GET /api/me/events
const getEvents = async (req, res) => {
  res.json({ events: await upcomingEvents(20) });
};

// POST /api/me/projects , GET /api/me/projects
const submitProject = async (req, res) => {
  const b = req.valid.body;
  const p = unwrap(
    await supabase.from('projects').insert([{ member_id: req.user.id, title: b.title, repo_url: b.repo_url, description: b.description || null }])
      .select('id, title, repo_url, description, submitted_at').single(),
    'Could not save project'
  );
  res.status(201).json({ project: p });
};
const myProjects = async (req, res) => {
  const data = unwrap(
    await supabase.from('projects').select('id, title, repo_url, description, submitted_at').eq('member_id', req.user.id).order('submitted_at', { ascending: false }),
    'Could not load projects'
  );
  res.json({ projects: data });
};

module.exports = { getProfile, updateProfile, getHome, getAnalytics, getEvents, submitProject, myProjects };
