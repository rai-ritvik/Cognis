# Cognis Backend

Express 5 + Supabase/Postgres/PostGIS. Face matching and liveness are handled by the separate FastAPI service in `../face-detection-recognition`.

## Quick start

1. Use Node.js 20 or later. For the frontend build, use Node.js 20.19+ or a current Node.js 22 release.
2. Run `npm ci`.
3. Copy `.env.example` to `.env`; fill `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and a long random `JWT_SECRET`.
4. Set `ML1_URL` to the deployed ML service or `http://localhost:8001` for local ML.
5. Run `npm test`, then `npm run dev`.
6. Verify `http://localhost:5000/api/health` returns HTTP 200 and `database: "ok"`.

**Do not blindly execute `sql/001_v2_schema.sql` on a populated database.** It contains `DELETE` statements that clear member, session, attendance, project, and alert data. Back up the database and review that script before use. Use the additive migrations `003_friend_requests.sql`, `004_student_number_8_to_13_digits.sql`, and `005_profile_photo.sql`, and `006_spoof_alert_review_status.sql` where applicable; test them in staging first.

## Main routes

- `/api/auth` — registration, login, OTP password reset.
- `/api/me` — member profile, home, analytics, events, projects, friend requests.
- `/api/sessions` — active session, start/rotate/end, scheduling, attendance list.
- `/api/attendance/checkin` — room code, geofence, face/liveness verification and attendance persistence.
- `/api/admin` — member management, flags, alerts/review, events and analytics.

All protected routes require `Authorization: Bearer <JWT>`. Student identity is taken from the signed JWT, not from the request body. The Supabase service-role key and JWT secret must never be exposed to the frontend. If `ML_API_KEY` is configured in the ML service, configure the same secret in the backend so service-to-service requests use `X-API-Key`.

## Safety notes

- Passwords are bcrypt hashed; login attempts are rate limited.
- Attendance fails closed if the ML service is unavailable, the face identity check fails, or liveness fails.
- A member can check in only once per session.
- The backend does not automatically mark attendance based on frontend-supplied identity fields.
- Profile photo base64 is stored in the `members` row after applying `005_profile_photo.sql`; only the signed-in profile endpoint selects it. For larger deployments, move photos to a private object-storage bucket with access controls and retention rules.
- The deployed database must have the `verify_location` PostGIS RPC and the expected columns. Never assume the schema matches the code without checking.
