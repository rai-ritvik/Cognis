# OmniScan backend integration (Express + Supabase + Face Attendance ML API)

This backend has been adapted to the `face-detection-recognition` ML API contract. It deliberately does not contain `.env`, service keys, or `node_modules`.

## Important security step
The previously uploaded backend archive contained a `.env` file. Rotate the Supabase service-role key and JWT secret before using this code. Never commit `.env`; only commit `.env.example`.

## ML API contract
- Enrollment: `POST /enroll` with `{ student_id, full_name, frames }`, 3-8 camera frames. The ML API returns `reference_embedding` (512 numeric values), stored in `members.face_embedding`.
- Attendance: `POST /verify` with `{ reference_embedding, frames }`, 15-20 camera frames. The ML API returns `verified`, `similarity`, and `liveness.passed`. Attendance is rejected unless both `verified` and `liveness.passed` are true.
- The ML API does not store member or attendance records. Supabase remains the source of truth.
- Configure the same `ML_API_KEY` secret in both ML service and backend Render service to protect service-to-service calls. If the ML service has no `ML_API_KEY`, API-key authentication is disabled; do not leave it publicly writable for production.
- ML calls have a 120-second timeout because multi-frame inference is expensive on a small service.

## Local setup
1. Install Node.js 20 or later.
2. In this directory run `npm install`.
3. Copy `.env.example` to `.env` and fill in the rotated Supabase URL/service key and a new random JWT secret. Configure `ML1_URL=https://omni-face-ml-api.onrender.com`.
4. Confirm `CORS_ORIGINS=http://localhost:5173,https://omni-scan-kappa.vercel.app`.
5. Run `npm test`, then `npm run dev`.
6. Open `http://localhost:5000/api/health`; expect HTTP 200 and `database: "ok"`.

## Frontend contract change required
The frontend must submit `frames`, not `image_base64`: registration sends 3-8 base64 JPEG frames; attendance check-in sends 15-20 frames. Use approximately 640x480 JPEG images at quality 65-75, as recommended by the ML service. Keep each frame under 360,000 characters and the whole request under the server request-size limit. Send the frames as data URLs or base64 strings accepted by the ML service.

Registration body fields: `roll_number`, `full_name`, `email`, `password`, `domain`, `year`, `consent: true`, `frames`, optional `github_handle`.

Attendance body fields: `session_id`, `room_token`, `latitude`, `longitude`, `frames`. Keep `Authorization: Bearer <token>`.

## Deploy to Render
- Create a Web Service from the Cognis repository.
- Root directory: `backend` (if that is the directory containing this `package.json`).
- Build command: `npm install`; start command: `npm start`.
- Set environment variables from `.env.example` in Render's Environment page. Never set them in the frontend.
- Ensure the production database schema has already been applied safely. **Do not blindly run `sql/001_v2_schema.sql`: it contains DELETE statements that erase rows from several tables.** Review and back up production data before any migration.
- Test `https://<your-backend-host>/api/health`, login, profile, session, and attendance.
- Set the Vercel frontend's API base URL to `https://<your-backend-host>` and redeploy. Use the exact variable name expected by the frontend source.

## Notes
- `MATCH_AUTO_THRESHOLD` sends an ML-verified match below the local auto threshold to `PENDING_REVIEW`; it does not override failed ML identity or liveness checks. Calibrate thresholds on representative data before production.
- Failed check-in alerts currently retain the first submitted frame in the `spoof_alerts` row to preserve the existing admin-review workflow. Restrict access and define retention/deletion rules for biometric data.
