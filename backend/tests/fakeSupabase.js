// A tiny in-memory imitation of the parts of supabase-js our code uses.
// It lets `npm test` verify the whole API WITHOUT internet or a real database.
const UNIQUE = { members: [['roll_number'], ['email']], attendance: [['session_id', 'member_id']] };
const FK = { members: 'member_id', sessions: 'session_id' };

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function splitTop(s) { // split "a, b, members(x, y)" on top-level commas
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function createFake() {
  const db = {};
  let seq = 1;
  const tbl = (t) => (db[t] = db[t] || []);

  class Q {
    constructor(t) { this.t = t; this.op = null; this.filters = []; this.cols = '*'; this.opts = {}; this.ord = null; this.lim = null; this.mode = null; this.payload = null; this.returning = false; }
    select(cols, opts) { if (!this.op) this.op = 'select'; else this.returning = true; this.cols = cols || '*'; this.opts = opts || {}; return this; }
    insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
    in(c, arr) { this.filters.push((r) => arr.includes(r[c])); return this; }
    gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
    order(c, o) { this.ord = { c, asc: !o || o.ascending !== false }; return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }

    project(row) {
      const cols = this.cols === '*' ? null : splitTop(this.cols);
      if (!cols) return { ...row };
      const out = {};
      for (const c of cols) {
        const m = c.match(/^(\w+)(?:!\w+)?\((.*)\)$/);
        if (m) {
          const target = m[1];
          const fk = this.t === 'flags' || this.t === 'attendance' || this.t === 'spoof_alerts' || this.t === 'projects' ? FK[target] : FK[target];
          const rel = tbl(target).find((r) => r.id === row[fk]);
          if (!rel) { out[target] = null; continue; }
          const sub = splitTop(m[2]); const o = {}; sub.forEach((k) => { o[k] = rel[k]; }); out[target] = o;
        } else out[c] = row[c];
      }
      return out;
    }

    finish(rows) {
      let r = rows.map((x) => this.project(x));
      if (this.mode === 'single') {
        if (r.length !== 1) return { data: null, error: { message: 'single row expected', code: 'PGRST116' } };
        return { data: r[0], error: null };
      }
      if (this.mode === 'maybe') {
        if (r.length > 1) return { data: null, error: { message: 'multiple rows', code: 'PGRST116' } };
        return { data: r[0] || null, error: null };
      }
      return { data: r, error: null };
    }

    run() {
      const rows = tbl(this.t);
      const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'select') {
        let m = matches();
        if (this.ord) m = [...m].sort((a, b) => (a[this.ord.c] > b[this.ord.c] ? 1 : a[this.ord.c] < b[this.ord.c] ? -1 : 0) * (this.ord.asc ? 1 : -1));
        const total = m.length;
        if (this.lim != null) m = m.slice(0, this.lim);
        if (this.opts.head) return { data: null, count: total, error: null };
        const res = this.finish(m);
        if (this.opts.count) res.count = total;
        return res;
      }
      if (this.op === 'insert') {
        const created = [];
        for (const p of this.payload) {
          for (const cols of UNIQUE[this.t] || []) {
            if (rows.some((r) => cols.every((c) => String(r[c]).toLowerCase() === String(p[c]).toLowerCase()))) {
              return { data: null, error: { message: 'duplicate key', code: '23505' } };
            }
          }
          const row = { id: `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`, created_at: new Date(Date.now() + seq).toISOString(), ...p };
          if (this.t === 'sessions') row.created_at = row.created_at;
          if (this.t === 'flags' || this.t === 'password_resets') { row.active = row.active ?? true; row.used = row.used ?? false; row.attempts = row.attempts ?? 0; }
          if (this.t === 'members') { row.role = row.role || 'member'; row.is_removed = false; row.skills = []; }
          if (this.t === 'spoof_alerts') row.reviewed = false;
          if (this.t === 'projects') row.submitted_at = row.created_at;
          rows.push(row); created.push(row);
        }
        return this.returning || this.mode ? this.finish(created) : { data: null, error: null };
      }
      if (this.op === 'update') {
        const m = matches(); m.forEach((r) => Object.assign(r, this.payload));
        return this.returning || this.mode ? this.finish(m) : { data: null, error: null };
      }
      if (this.op === 'delete') {
        const m = matches(); db[this.t] = rows.filter((r) => !m.includes(r));
        return this.returning || this.mode ? this.finish(m) : { data: null, error: null };
      }
      return { data: null, error: { message: 'unsupported' } };
    }
  }

  return {
    db,
    from: (t) => new Q(t),
    rpc: async (name, args) => {
      if (name !== 'verify_location') return { data: null, error: { message: 'unknown rpc' } };
      const s = tbl('sessions').find((r) => r.id === args.session_id_param);
      if (!s) return { data: { is_within_radius: false, distance_meters: null }, error: null };
      const [lng, lat] = s.lab_location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
      const d = haversine(lat, lng, args.student_lat, args.student_lon);
      return { data: { is_within_radius: d <= (s.radius_m || 15), distance_meters: d }, error: null };
    },
  };
}
module.exports = { createFake };
