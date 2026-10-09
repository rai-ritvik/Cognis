# Cognis - Backend

Express 5 + Supabase (Postgres/PostGIS). Face matching is done by the separate ML1 service.

## Quick start
1. `npm install`
2. Copy `.env.example` to `.env` and fill it (never commit `.env`).
3. Run `sql/001_v2_schema.sql` in the Supabase SQL editor, register yourself, then run `sql/002_make_admin.sql`.
4. `npm test` (offline tests, no database needed) then `npm run dev`.
5. No ML1 yet? `node tools/mock-ml.js` in a second terminal.

## Layout
`config/` env + database client - `middleware/` auth, validation, rate limits, errors - `validators/` input rules -
`services/` ML client, room code, mail, stats - `controllers/` the logic - `routes/` URL -> controller - `sql/` database - `tests/` offline tests.

## Security rules baked in
Passwords are bcrypt hashed - identity comes from the JWT, never the request body - ML down means check-in FAILS (no auto-pass) -
one check-in per student per session - room code expires on the server - RLS is on for every table - service key stays on the server.
