const { createClient } = require('@supabase/supabase-js/dist/index.cjs');
const env = require('./env');

// IMPORTANT: this uses the SERVICE key. It bypasses Row Level Security,
// so it must only ever live on the server (never in the frontend).
const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
