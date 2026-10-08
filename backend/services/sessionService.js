const supabase = require('../config/supabaseClient');

// Sessions close themselves when their end time passes (no cron job needed):
// every time we look at an ACTIVE session we check ends_at first.
async function closeIfExpired(session) {
  if (session && session.status === 'ACTIVE' && session.ends_at && new Date(session.ends_at) <= new Date()) {
    await supabase
      .from('sessions')
      .update({ status: 'CLOSED', current_room_token: null, previous_room_token: null })
      .eq('id', session.id);
    return { ...session, status: 'CLOSED' };
  }
  return session;
}

const locationWkt = (lat, lng) => `POINT(${lng} ${lat})`; // PostGIS wants LONGITUDE first

module.exports = { closeIfExpired, locationWkt };
