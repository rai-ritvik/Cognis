// Turns "all sessions" + "this member's attendance rows" into a history with percentages.
// Used by the member analytics page AND the admin analytics.
function buildHistory(sessions, attendanceRows, memberCreatedAt) {
  const attMap = new Map(attendanceRows.map((a) => [a.session_id, a]));
  const since = new Date(memberCreatedAt).getTime();
  const rows = [];

  for (const s of sessions) {
    const start = s.starts_at || s.created_at;
    if (new Date(start).getTime() < since) continue; // sessions before the member joined do not count

    const a = attMap.get(s.id);
    let status;
    if (a) status = a.status === 'PRESENT' ? 'Present' : a.status === 'PENDING_REVIEW' ? 'Pending' : 'Absent';
    else status = s.status === 'CLOSED' ? 'Absent' : 'Not marked'; // an open session is not "absent" yet

    rows.push({
      session_id: s.id,
      title: s.title,
      starts_at: start,
      ends_at: s.ends_at || null,
      status,
      marked_at: a ? a.created_at : null,
    });
  }

  const count = (st) => rows.filter((r) => r.status === st).length;
  const present = count('Present');
  const absent = count('Absent');
  const pending = count('Pending');
  const total = present + absent + pending; // "Not marked" (still open) is excluded
  const percent = total ? Math.round((present / total) * 1000) / 10 : 0;
  return { rows, present, absent, pending, total, percent };
}

module.exports = { buildHistory };
