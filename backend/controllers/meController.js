const supabase = require('../config/supabaseClient');
const AppError = require('../utils/AppError');
const { unwrap } = require('../utils/db');
const { buildHistory } = require('../services/statsService');
const { dayKey, monthKey } = require('../utils/time');

const PROFILE_COLS = 'id, roll_number, full_name, email, domain, year, github_handle, bio, skills, linkedin_url, instagram_url, profile_photo_base64, role, created_at';

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


const listFriends = async (req, res) => {
  const memberId = req.user.id;
  const rows = unwrap(
    await supabase.from('friend_requests')
      .select('id, requester_id, recipient_id, status, created_at')
      .or(`requester_id.eq.${memberId},recipient_id.eq.${memberId}`)
      .order('created_at', { ascending: false }).limit(500),
    'Could not load friends'
  );
  const otherIds = [...new Set(rows.map((row) => row.requester_id === memberId ? row.recipient_id : row.requester_id))];
  const members = otherIds.length
    ? unwrap(await supabase.from('members').select('id, full_name, roll_number, domain, year').in('id', otherIds), 'Could not load friend profiles')
    : [];
  const byId = new Map(members.map((member) => [member.id, member]));
  const friends = rows.filter((row) => row.status === 'ACCEPTED').map((row) => ({
    id: row.id,
    member: (() => { const m = byId.get(row.requester_id === memberId ? row.recipient_id : row.requester_id); return m ? { ...m, academic_year: m.year } : null; })(),
  }));
  const requests = rows.filter((row) => row.status === 'PENDING').map((row) => ({
    id: row.id,
    incoming: row.recipient_id === memberId,
    member: (() => { const m = byId.get(row.requester_id === memberId ? row.recipient_id : row.requester_id); return m ? { ...m, academic_year: m.year } : null; })(),
  }));
  res.json({ friends, requests });
};

const sendFriendRequest = async (req, res) => {
  const rollNumber = req.valid.body.roll_number;
  const target = unwrap(await supabase.from('members').select('id, is_removed').eq('roll_number', rollNumber).maybeSingle(), 'Could not find student');
  if (!target || target.is_removed) throw new AppError(404, 'No active student has that student number');
  if (target.id === req.user.id) throw new AppError(400, 'You cannot send a friend request to yourself');
  const existing = unwrap(
    await supabase.from('friend_requests').select('id, status')
      .or(`and(requester_id.eq.${req.user.id},recipient_id.eq.${target.id}),and(requester_id.eq.${target.id},recipient_id.eq.${req.user.id})`)
      .limit(1).maybeSingle(),
    'Could not check existing friend request'
  );
  if (existing?.status === 'ACCEPTED') throw new AppError(409, 'You are already friends');
  if (existing?.status === 'PENDING') throw new AppError(409, 'A friend request is already pending');
  if (existing?.status === 'REJECTED') {
    unwrap(await supabase.from('friend_requests').delete().eq('id', existing.id), 'Could not retry friend request');
  }
  unwrap(await supabase.from('friend_requests').insert([{
    requester_id: req.user.id, recipient_id: target.id, status: 'PENDING',
  }]), 'Could not send friend request');
  res.status(201).json({ message: 'Friend request sent' });
};

const respondFriendRequest = async (req, res) => {
  const { id } = req.valid.params;
  const { status } = req.valid.body;
  const row = unwrap(
    await supabase.from('friend_requests').update({ status, responded_at: new Date().toISOString() })
      .eq('id', id).eq('recipient_id', req.user.id).eq('status', 'PENDING')
      .select('id').maybeSingle(),
    'Could not update friend request'
  );
  if (!row) throw new AppError(404, 'Pending incoming friend request not found');
  res.json({ message: status === 'ACCEPTED' ? 'Friend request accepted' : 'Friend request declined' });
};

module.exports = { getProfile, updateProfile, getHome, getAnalytics, getEvents, submitProject, myProjects, listFriends, sendFriendRequest, respondFriendRequest };
