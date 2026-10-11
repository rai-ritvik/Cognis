# Cognis

**Biometric, location-aware attendance and society engagement platform**

Cognis is a backend API for managing member registration, face-based
attendance, lab-session access, member profiles, society events, project
submissions, and admin review. It uses an Express API,
Supabase/PostgreSQL with PostGIS, and a separate ML service for face
verification and liveness checks.

> **Current deployment** - Backend API:
> `https://cognis-backend-api.onrender.com` - Health check:
> `https://cognis-backend-api.onrender.com/api/health` - ML API:
> `https://omni-face-ml-api.onrender.com` - ML API docs:
> `https://omni-face-ml-api.onrender.com/docs`
>
> The backend health endpoint checks the database connection. A healthy
> response does **not**, by itself, prove that a full face-enrollment or
> attendance request has succeeded end to end.

## Contents

-   [Features](#features)
-   [Architecture](#architecture)
-   [Technology stack](#technology-stack)
-   [Repository structure](#repository-structure)
-   [Requirements](#requirements)
-   [Local setup](#local-setup)
-   [Environment variables](#environment-variables)
-   [Database setup and safety](#database-setup-and-safety)
-   [API overview](#api-overview)
-   [Registration and attendance
    contracts](#registration-and-attendance-contracts)
-   [Authentication](#authentication)
-   [ML service integration](#ml-service-integration)
-   [Testing](#testing)
-   [Deployment on Render](#deployment-on-render)
-   [Security and privacy](#security-and-privacy)
-   [Known limitations and verification
    status](#known-limitations-and-verification-status)

## Features

-   Member registration and login with password hashing.
-   JWT authentication and role-based admin authorization.
-   Face enrollment through the separate ML API.
-   Attendance check-in using multiple camera frames, face verification,
    liveness checks, a rotating room token, and a GPS geofence.
-   Server-side room-token expiry and a short grace period during token
    rotation.
-   Attendance statuses of `PRESENT` and `PENDING_REVIEW`.
-   Session scheduling, starting, rotating the room token, ending
    sessions, and viewing attendance.
-   Member profiles, dashboard data, analytics, events, and project
    submissions.
-   Admin member management, flags, failed-check-in alerts, and review
    actions.
-   Request validation, rate limiting, Helmet security headers, and
    restricted CORS origins.
-   Fail-closed ML behaviour: an unavailable or misconfigured ML service
    must not automatically approve attendance.

## Architecture

``` text
Web frontend
    |
    | HTTPS / JSON + JWT
    v
Cognis API (Node.js + Express)
    |                         |
    | Supabase queries/RPC    | Authenticated server-to-server HTTP
    v                         v
Supabase                  ML face API
PostgreSQL + PostGIS       Enrollment + face verification + liveness
```

The frontend should call the Cognis backend, not the ML service
directly. Supabase service credentials, JWT secrets, and the ML API key
must remain server-side.

## Technology stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  API                                 Node.js 20+, Express 5

  Database                            Supabase PostgreSQL

  Geofencing                          PostGIS `geography` and the
                                      `verify_location` database function

  Face service                        Separate Python/FastAPI ML API

  Authentication                      JWT and bcrypt

  Validation                          Zod

  HTTP client                         Axios

  Security and middleware             Helmet, CORS, express-rate-limit

  Email                               Nodemailer for password-reset codes

  Hosting                             Render (backend and ML service);
                                      Vercel (frontend)
  -----------------------------------------------------------------------

## Repository structure

The deployed Render service is configured to run the backend folder. The
exact root layout can vary depending on the branch/monorepo layout.

``` text
Cognis/
├── backend/
│   ├── config/          # Environment and Supabase client
│   ├── controllers/     # Authentication, attendance, sessions, profile, admin
│   ├── middleware/      # Authentication, validation, errors, rate limits
│   ├── routes/          # Express route definitions
│   ├── services/        # ML client, room-token, mail, statistics helpers
│   ├── validators/      # Zod request schemas
│   ├── sql/             # Database SQL scripts
│   ├── tests/           # API tests and test doubles
│   ├── tools/           # Development utilities
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/            # Frontend application, if included in the checkout
└── README.md
```

## Requirements

-   Node.js **20 or later**
-   npm
-   A Supabase project with the schema required by this backend
-   Access to the deployed ML API, or a local ML API compatible with the
    documented contract
-   Git

## Local setup

From the repository root, move into the backend directory:

``` bash
cd backend
npm install
```

Create a local environment file:

**Windows PowerShell**

``` powershell
Copy-Item .env.example .env
```

**macOS / Linux**

``` bash
cp .env.example .env
```

Fill in `.env` using the [environment variables](#environment-variables)
section. Do not commit this file.

Run the tests:

``` bash
npm test
```

Start the development server:

``` bash
npm run dev
```

Or run the production start command locally:

``` bash
npm start
```

By default, the API listens on port `5000`. Check:

``` text
GET http://localhost:5000/api/health
```

A healthy response resembles:

``` json
{
  "status": "ok",
  "database": "ok",
  "time": "2026-10-12T00:00:00.000Z"
}
```

The `time` value is generated at request time and will differ. If the
database check fails, the endpoint returns HTTP `503` with a degraded
status.

## Environment variables

Configure these in `backend/.env` for local development and in the
hosting provider's environment settings for deployment.

  -----------------------------------------------------------------------------
  Variable                                       Required Purpose
  -------------------------- ---------------------------- ---------------------
  `PORT`                                               No API port; defaults to
                                                          `5000`. Render can
                                                          provide this
                                                          automatically.

  `NODE_ENV`                                           No Runtime environment,
                                                          such as `development`
                                                          or `production`.

  `CORS_ORIGINS`                              Recommended Comma-separated exact
                                                          frontend origins
                                                          allowed to call the
                                                          API. Include local
                                                          development and the
                                                          deployed frontend as
                                                          needed.

  `SUPABASE_URL`                                      Yes Supabase project URL.

  `SUPABASE_SERVICE_KEY`                              Yes Server-only Supabase
                                                          service key. Never
                                                          expose it to the
                                                          browser.

  `JWT_SECRET`                                        Yes Long, random secret
                                                          used to sign
                                                          authentication
                                                          tokens.

  `ML1_URL`                                            No Base URL for the ML
                                                          service. Defaults to
                                                          the deployed ML API
                                                          in `.env.example`.

  `ML_API_KEY`                  If ML key auth is enabled API key sent to the
                                                          ML service in the
                                                          `X-API-Key` header.
                                                          Must match the key
                                                          configured on the ML
                                                          service.

  `ML_TIMEOUT_MS`                                      No ML request timeout;
                                                          configured for slower
                                                          multi-frame
                                                          inference.

  `MATCH_AUTO_THRESHOLD`                               No Similarity threshold
                                                          for marking an
                                                          ML-approved check-in
                                                          `PRESENT`; default
                                                          `0.80`.

  `MATCH_REVIEW_THRESHOLD`                             No Review threshold
                                                          setting; confirm its
                                                          current use in the
                                                          service code before
                                                          changing it.

  `LAB_LAT`                                            No Default lab latitude
                                                          when session
                                                          coordinates are not
                                                          supplied.

  `LAB_LNG`                                            No Default lab longitude
                                                          when session
                                                          coordinates are not
                                                          supplied.

  `LAB_RADIUS_M`                                       No Default geofence
                                                          radius in metres;
                                                          defaults to `15`.

  `ROOM_TOKEN_TTL_SECONDS`                             No Lifetime of a
                                                          rotating room token;
                                                          defaults to `30`
                                                          seconds.

  `SMTP_HOST`                                          No SMTP server for
                                                          password-reset
                                                          emails.

  `SMTP_PORT`                                          No SMTP port; defaults
                                                          to `465`.

  `SMTP_USER`                        For configured email SMTP username.

  `SMTP_PASS`                        For configured email SMTP password or
                                                          provider-specific app
                                                          password.

  `SMTP_FROM`                                          No Sender address;
                                                          defaults to the
                                                          configured SMTP user
                                                          when available.
  -----------------------------------------------------------------------------

Generate a JWT secret locally with:

``` bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not paste secrets into source code, frontend environment variables,
screenshots, issue trackers, or chat messages. If a secret has ever been
committed or shared, rotate it.

## Database setup and safety

The backend depends on the database tables and PostGIS function expected
by the current backend code. The supplied SQL files are in
`backend/sql/`.

**Important: do not blindly execute `sql/001_v2_schema.sql` against an
existing database.** The version included in the reviewed archive
contains `DELETE` statements that clear rows from several tables. It
also enforces a 13-digit numeric student number in the database. Back up
the database and inspect the script line by line before running it.
Prefer a reviewed migration that preserves existing data.

The current backend expects, at minimum, the member, session,
attendance, and supporting admin/profile tables used by its controllers.
It also calls the PostGIS RPC function `verify_location`. The schema and
deployed database must agree with the application code.

The current request validator in the reviewed source requires a student
number of exactly **13 digits**. If the product requirement is to accept
8--13 digits, change both the API validator and the database constraint
together, then test registration, login, password recovery, and existing
records before deploying.

To grant an existing member admin access, inspect
`sql/002_make_admin.sql` first. The example script contains a specific
roll number; replace it with the intended account's roll number before
executing it. Do not grant admin access to an account you have not
verified.

## API overview

Base URL for local development:

``` text
http://localhost:5000
```

Production base URL:

``` text
https://cognis-backend-api.onrender.com
```

### Health

  -----------------------------------------------------------------------
  Method            Path              Access            Purpose
  ----------------- ----------------- ----------------- -----------------
  `GET`             `/api/health`     Public            Checks whether
                                                        the API can query
                                                        Supabase. It does
                                                        not test ML
                                                        inference.

  -----------------------------------------------------------------------

### Authentication

  ----------------------------------------------------------------------------------
  Method            Path                         Access            Purpose
  ----------------- ---------------------------- ----------------- -----------------
  `POST`            `/api/auth/register`         Public,           Register a member
                                                 rate-limited      and enroll their
                                                                   face.

  `POST`            `/api/auth/login`            Public,           Log in and
                                                 rate-limited      receive a JWT.

  `POST`            `/api/auth/forgot`           Public,           Request a
                                                 rate-limited      password-reset
                                                                   code.

  `POST`            `/api/auth/verify-otp`       Public,           Verify the reset
                                                 rate-limited      code.

  `POST`            `/api/auth/reset-password`   Public,           Set a new
                                                 rate-limited      password using
                                                                   the reset token.
  ----------------------------------------------------------------------------------

### Attendance

  ---------------------------------------------------------------------------------
  Method            Path                        Access            Purpose
  ----------------- --------------------------- ----------------- -----------------
  `POST`            `/api/attendance/checkin`   Logged-in member, Validate the
                                                rate-limited      active session,
                                                                  room token,
                                                                  location, face,
                                                                  and liveness,
                                                                  then record
                                                                  attendance.

  ---------------------------------------------------------------------------------

### Sessions

All session routes require a valid JWT. The active-session endpoint is
available to any authenticated member; the other listed
session-management endpoints require an admin account.

  --------------------------------------------------------------------------------------
  Method            Path                             Access            Purpose
  ----------------- -------------------------------- ----------------- -----------------
  `GET`             `/api/sessions/active`           Authenticated     Get the current
                                                                       active session.
                                                                       Admins also
                                                                       receive the
                                                                       current room
                                                                       token.

  `GET`             `/api/sessions`                  Admin             List recent
                                                                       sessions.

  `POST`            `/api/sessions/schedule`         Admin             Schedule a
                                                                       session.

  `POST`            `/api/sessions/start`            Admin             Start a scheduled
                                                                       session or create
                                                                       and start a
                                                                       session.

  `POST`            `/api/sessions/rotate`           Admin             Rotate the room
                                                                       token.

  `POST`            `/api/sessions/end`              Admin             End a session.

  `GET`             `/api/sessions/:id/attendance`   Admin             View attendance
                                                                       for a session.
  --------------------------------------------------------------------------------------

### Member profile and personal data

All routes below require a valid JWT.

  Method    Path                  Purpose
  --------- --------------------- ----------------------------------
  `GET`     `/api/me/profile`     Get the member profile.
  `PATCH`   `/api/me/profile`     Update supported profile fields.
  `GET`     `/api/me/home`        Get home/dashboard data.
  `GET`     `/api/me/analytics`   Get member analytics.
  `GET`     `/api/me/events`      List events for the member view.
  `GET`     `/api/me/projects`    List the member's projects.
  `POST`    `/api/me/projects`    Submit a project.

### Admin

All `/api/admin/*` routes require a valid JWT **and** an admin role.

  ----------------------------------------------------------------------------------
  Method                  Path                               Purpose
  ----------------------- ---------------------------------- -----------------------
  `GET`                   `/api/admin/dashboard`             Admin dashboard data.

  `GET`                   `/api/admin/analytics`             Admin analytics.

  `GET`                   `/api/admin/members`               List members.

  `POST`                  `/api/admin/members/:id/remove`    Remove/disable a
                                                             member.

  `POST`                  `/api/admin/members/:id/restore`   Restore a member.

  `POST`                  `/api/admin/members/:id/flag`      Flag a member.

  `POST`                  `/api/admin/members/:id/unflag`    Remove a member flag.

  `GET`                   `/api/admin/flags`                 List flags.

  `POST`                  `/api/admin/events`                Create an event.

  `DELETE`                `/api/admin/events/:id`            Delete an event.

  `GET`                   `/api/admin/alerts`                List check-in alerts.

  `GET`                   `/api/admin/alerts/:id`            View an alert.

  `POST`                  `/api/admin/alerts/:id/review`     Approve or reject an
                                                             alert.

  `GET`                   `/api/admin/projects`              List submitted
                                                             projects.
  ----------------------------------------------------------------------------------

Request schemas and controller behaviour are the authoritative reference
for exact fields, response shapes, and error codes. This README provides
a route overview rather than replacing the source validators.

## Registration and attendance contracts

### Register a member

`POST /api/auth/register`

The current reviewed validator expects 3--8 image frames and explicit
biometric consent.

``` json
{
  "roll_number": "1234567890123",
  "full_name": "Test Student",
  "email": "student@example.com",
  "password": "Use-a-strong-test-password",
  "domain": "CSE AI/ML",
  "year": "1",
  "consent": true,
  "frames": [
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/jpeg;base64,..."
  ],
  "github_handle": "example-user"
}
```

Notes: - The example values are placeholders. Use a dedicated test
account. - Do not submit a fake sequence made by duplicating one still
image. - Capture clear frames from a live camera sequence and send the
format accepted by the ML API. - The current backend validator limits
each frame to 360,000 characters and the request body to 10 MB. - A
successful registration returns a member object. Registration does not
automatically log the member in; call the login endpoint separately.

### Log in

`POST /api/auth/login`

``` json
{
  "roll_number": "1234567890123",
  "password": "Use-a-strong-test-password"
}
```

A successful response contains a JWT `token` and a limited `member`
object. Use the token as a Bearer token for protected routes.

### Check in to a session

`POST /api/attendance/checkin`

Headers:

``` text
Authorization: Bearer <JWT>
Content-Type: application/json
```

Body:

``` json
{
  "session_id": "<active-session-uuid>",
  "room_token": "1234",
  "latitude": 28.000000,
  "longitude": 77.000000,
  "frames": [
    "data:image/jpeg;base64,..."
  ]
}
```

The real request must contain **15--20 captured frames**; the one-frame
snippet above only illustrates the field format and is not a valid
attendance request. Use real coordinates and the current room token from
an active session.

A successful response can report `PRESENT` or `PENDING_REVIEW`. A failed
location, token, identity, or liveness check should not be bypassed.
Duplicate attendance is rejected.

## Authentication

Send the JWT on protected requests:

``` text
Authorization: Bearer <JWT>
```

-   `401 Unauthorized` generally means credentials are invalid or the
    token is missing/expired.
-   `403 Forbidden` means the request is not allowed, for example
    because the user lacks the admin role or a verification check
    failed.
-   Admin routes require both a valid token and an admin role.
-   Do not trust a role or member ID supplied by the frontend; the
    backend derives the authenticated identity from the JWT.

## ML service integration

The backend calls the ML service from the server using `ML1_URL` and,
when configured, the `X-API-Key` header from `ML_API_KEY`.

The reviewed integration contract is:

-   **Enrollment:** `POST /enroll` with `student_id`, `full_name`, and
    3--8 `frames`; the ML service returns a 512-number
    `reference_embedding`.
-   **Verification:** `POST /verify` with the stored
    `reference_embedding` and 15--20 live `frames`; the ML service
    returns identity-verification and liveness results.
-   The backend stores the reference embedding in Supabase; the ML API
    is used for inference and is not the system of record for member or
    attendance data.
-   If the ML service is unreachable or rejects the API key,
    registration/check-in should fail rather than silently bypass face
    verification.
-   `MATCH_AUTO_THRESHOLD` determines whether a successfully ML-verified
    check-in is marked `PRESENT` or `PENDING_REVIEW`. It does not
    replace the ML service's identity or liveness decision.

The ML service can be tested separately at
`https://omni-face-ml-api.onrender.com/docs`. A successful direct ML
health request proves that the ML service and supplied key work from
that client; it does not by itself prove the backend's environment or
backend-to-ML request path is configured correctly.

## Testing

Run the automated backend tests from the backend directory:

``` bash
npm test
```

The repository includes API tests and a fake Supabase implementation for
offline testing. Offline tests are useful for request/logic checks, but
they do not replace live integration tests against Supabase and the ML
service.

Recommended smoke-test sequence after deployment:

1.  `GET /api/health` returns HTTP `200` with `status: "ok"` and
    `database: "ok"`.
2.  Submit an empty registration request and confirm the API returns
    validation errors (this checks reachability only, not ML
    integration).
3.  Test registration using a dedicated test account and a genuine
    3--8-frame capture.
4.  Log in and verify the response contains a token.
5.  Use that token to request `/api/sessions/active` and
    `/api/me/profile`.
6.  With a test admin account, schedule/start a test session and verify
    token rotation.
7.  Perform an attendance test using a real 15--20-frame sequence,
    correct room token, and lab coordinates.
8.  Inspect sanitized Render logs if any call fails. Never share
    passwords, keys, raw images, or face embeddings in logs or issue
    reports.

## Deployment on Render

For a Render Web Service connected to the Cognis repository:

-   **Root directory:** `backend` if `package.json` and `server.js` are
    inside that folder.
-   **Build command:** `npm install`
-   **Start command:** `npm start`
-   Configure the production environment variables in Render's
    Environment settings.
-   Set `NODE_ENV=production`.
-   Set `CORS_ORIGINS` to exact allowed frontend origins, separated by
    commas. Do not use `*` for production.
-   Set `ML1_URL=https://omni-face-ml-api.onrender.com`.
-   Set `ML_API_KEY` to the same secret configured on the ML service, if
    API-key authentication is enabled there.
-   Confirm the database schema is already compatible before deploying.
-   After changing environment variables, redeploy/restart the service
    and check `/api/health`.

The frontend is deployed separately. Its API base URL should point to
`https://cognis-backend-api.onrender.com` using the variable name the
frontend code actually reads. Never put `SUPABASE_SERVICE_KEY`,
`JWT_SECRET`, or `ML_API_KEY` in frontend variables.

## Security and privacy

-   Never commit `.env`, database service keys, JWT secrets, SMTP
    passwords, ML API keys, raw camera frames, or face embeddings.
-   Store passwords only as secure hashes; do not log them.
-   Obtain clear, informed consent before capturing or processing
    biometric data.
-   Restrict access to alerts and any retained images; define retention
    and deletion policies for biometric and attendance data.
-   Keep Supabase access policies and server-side credentials
    appropriately restricted. Review RLS policies and the effects of
    service-role access before production use.
-   Keep CORS restricted to known origins.
-   Do not automatically approve attendance if the ML service is down,
    misconfigured, or returns an invalid response.
-   Use a test account and test session before any real attendance run.

## Known limitations and verification status

-   The backend and ML service are deployed separately. Deployment alone
    does not establish that every endpoint or the full face-attendance
    workflow is working.
-   The live `/api/health` endpoint has previously returned a healthy
    API/database status.
-   The ML service's authenticated health endpoint has previously
    returned `status: "ok"` when tested directly with a valid key.
-   A backend-to-ML diagnostic endpoint and a complete live
    enrollment/check-in test should be verified separately before
    describing the full ML flow as end-to-end tested.
-   The reviewed source currently validates student numbers as exactly
    13 digits. If the intended rule is 8--13 digits, the validator and
    database constraint still need a coordinated update.
-   Always treat the current deployed source and database schema as
    authoritative if they differ from this README or the archive used to
    write it.

## License

Internal project. Add a formal license only if the project is intended
to be open source.
