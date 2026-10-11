// const SESSION_KEY = "sa_session";
// const DEMO_SESSION_KEY = "netra_demo_active_session";
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
// const DEMO_ADMIN_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
// const DEMO_ADMIN_EMAIL = "admin@cognis.test";
// const DEMO_ADMIN_PASSWORD = "cognis-demo";
// const LEGACY_DEMO_ADMIN_EMAIL = "admin@netra.test";
// const LEGACY_DEMO_ADMIN_PASSWORD = "netra-demo";
// const DEMO_ATTENDEES = [
//   { roll_number: "2512056", name: "Ashutosh", status: "PRESENT", time_logged: "09:02 AM" },
//   { roll_number: "2512093", name: "Harsh Tomar", status: "PRESENT", time_logged: "09:04 AM" },
//   { roll_number: "2511503", name: "Ambesh Sharma", status: "PRESENT", time_logged: "09:05 AM" },
//   { roll_number: "2520041", name: "Rashi Sharma", status: "PRESENT", time_logged: "09:08 AM" },
//   { roll_number: "2500243", name: "Ritvik Rai", status: "PRESENT", time_logged: "09:11 AM" },
// ];

// const saveStudentSession = (result) => {
//   if (!result?.token || result.user?.role !== "student" || !result.user.studentId) {
//     throw new Error("The server returned an invalid student sign-in response.");
//   }
//   localStorage.setItem(SESSION_KEY, JSON.stringify(result.token));
//   return { ...result.user, token: result.token };
// };

// if (localStorage.getItem("sa_users")) {
//   localStorage.removeItem("sa_users");
// }

// export async function registerUser(details) {
//   const result = await requestApi("/api/auth/register", {
//     method: "POST",
//     body: details,
//   });
//   return saveStudentSession(result);
// }

// export async function loginUser({ studentId, password }) {
//   const result = await requestApi("/api/auth/login", {
//     method: "POST",
//     body: { identifier: studentId, password },
//   });
//   return saveStudentSession(result);
// }

// export async function loginWithGoogle(credential) {
//   const result = await requestApi("/api/auth/google", {
//     method: "POST",
//     body: { credential },
//   });
//   return saveStudentSession(result);
// }

// export const requestPasswordReset = (identifier) =>
//   requestApi("/api/auth/password/reset-request", {
//     method: "POST",
//     body: { identifier },
//   });

// export const completePasswordReset = (accessToken, password) =>
//   requestApi("/api/auth/password/reset", {
//     method: "POST",
//     body: { access_token: accessToken, password },
//   });

// async function requestApi(path, { method = "GET", body, token } = {}) {
//   const headers = { "Content-Type": "application/json" };
//   if (token) headers.Authorization = `Bearer ${token}`;
//   let response;
//   try {
//     response = await fetch(`${API_BASE_URL}${path}`, {
//       method,
//       headers,
//       ...(body ? { body: JSON.stringify(body) } : {}),
//     });
//   } catch (error) {
//     if (error instanceof TypeError) {
//       throw new Error(`Cannot reach the attendance server at ${API_BASE_URL}. Start the backend with "npm --prefix backend start" and check VITE_API_BASE_URL.`);
//     }
//     throw error;
//   }

//   let result;
//   try {
//     result = await response.json();
//   } catch {
//     throw new Error("The attendance server returned an invalid response. Check that the backend is running correctly.");
//   }
//   if (response.status === 401 && token) {
//     const session = getSession();
//     if (session?.token === token) localStorage.removeItem(SESSION_KEY);
//   }
//   if (!response.ok) throw new Error(result.error || "The request could not be completed.");
//   return result;
// }

// export async function loginAdmin({ email, password }) {
//   if (DEMO_ADMIN_ENABLED) {
//     const normalizedEmail = email.trim().toLowerCase();
//     const isCurrentDemoLogin =
//       normalizedEmail === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD;
//     const isLegacyDemoLogin =
//       normalizedEmail === LEGACY_DEMO_ADMIN_EMAIL && password === LEGACY_DEMO_ADMIN_PASSWORD;
//     if (
//       !isCurrentDemoLogin &&
//       !isLegacyDemoLogin
//     ) {
//       throw new Error("Incorrect demo admin email or password.");
//     }
//     const demoUser = {
//       name: "Demo Administrator",
//       email: DEMO_ADMIN_EMAIL,
//       role: "admin",
//       token: "development-demo-token",
//       demo: true,
//     };
//     localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
//     return demoUser;
//   }

//   const result = await requestApi("/api/auth/admin/login", {
//     method: "POST",
//     body: { email, password },
//   });
//   if (!result.token || result.user?.role !== "admin") {
//     throw new Error("The server returned an invalid admin sign-in response.");
//   }
//   const user = { ...result.user, token: result.token };
//   localStorage.setItem(SESSION_KEY, JSON.stringify(user));
//   return user;
// }

// const getDemoActiveSession = () => {
//   const session = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
//   return { active: Boolean(session), session };
// };

// const isDemoAdmin = () => DEMO_ADMIN_ENABLED && getSession()?.demo === true;

// export const getActiveAttendanceSession = () =>
//   DEMO_ADMIN_ENABLED ? Promise.resolve(getDemoActiveSession()) : requestApi("/api/sessions/active");

// export const checkInForAttendance = (details) =>
//   requestApi("/api/checkin", {
//     method: "POST",
//     body: details,
//     token: getSession()?.token,
//   });

// const requestStudentApi = (path, options = {}) => {
//   const session = getSession();
//   if (session?.role !== "student" || !session.token) {
//     throw new Error("Sign in with a student account to continue.");
//   }
//   return requestApi(path, { ...options, token: session.token });
// };

// export const getMyHome = () => requestStudentApi("/api/me/home");
// export const getMyAnalytics = () => requestStudentApi("/api/me/analytics");
// export const getMyProfile = () => requestStudentApi("/api/me/profile");
// export const updateMyProfile = (profile) =>
//   requestStudentApi("/api/me/profile", { method: "PATCH", body: profile });
// export const getMyFriends = () => requestStudentApi("/api/me/friends");
// export const sendFriendRequest = (rollNumber) =>
//   requestStudentApi("/api/me/friends", {
//     method: "POST",
//     body: { roll_number: rollNumber },
//   });
// export const respondToFriendRequest = (requestId, status) =>
//   requestStudentApi(`/api/me/friends/requests/${encodeURIComponent(requestId)}`, {
//     method: "PATCH",
//     body: { status },
//   });

// export const getAdminActiveAttendanceSession = () => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to manage attendance.");
//   }
//   if (isDemoAdmin()) return Promise.resolve(getDemoActiveSession());
//   return requestApi("/api/sessions/active/admin", { token: session.token });
// };

// export const getAdminMembers = () => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to view the student directory.");
//   }
//   if (isDemoAdmin()) {
//     return Promise.resolve({
//       members: DEMO_ATTENDEES.map(({ roll_number, name }) => ({
//         roll_number,
//         full_name: name,
//       })),
//     });
//   }
//   return requestApi("/api/members", { token: session.token });
// };

// const requestAdminApi = (path, options = {}) => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to continue.");
//   }
//   if (isDemoAdmin()) {
//     throw new Error("This admin workflow requires the backend; demo mode only supports portal controls and sample members.");
//   }
//   return requestApi(path, { ...options, token: session.token });
// };

// export const getAdminReviews = () => requestAdminApi("/api/admin/reviews");
// export const reviewAttendance = (attendanceId, decision, reason = "") =>
//   requestAdminApi(`/api/admin/reviews/${encodeURIComponent(attendanceId)}`, {
//     method: "PATCH",
//     body: { decision, reason },
//   });
// export const getAdminFlags = () => requestAdminApi("/api/admin/flags");
// export const setAttendanceFlag = (attendanceId, flagged, reason = "") =>
//   requestAdminApi(`/api/admin/flags/${encodeURIComponent(attendanceId)}`, {
//     method: "PATCH",
//     body: { flagged, reason },
//   });
// export const getAdminAnalytics = () => requestAdminApi("/api/admin/analytics");
// export const getAdminEvents = () => requestAdminApi("/api/admin/events");
// export const createAdminEvent = (event) =>
//   requestAdminApi("/api/admin/events", { method: "POST", body: event });
// export const cancelAdminEvent = (eventId) =>
//   requestAdminApi(`/api/admin/events/${encodeURIComponent(eventId)}`, {
//     method: "PATCH",
//     body: { status: "CANCELLED" },
//   });
// export const getAdminSchedules = () => requestAdminApi("/api/admin/schedules");
// export const createAdminSchedule = (schedule) =>
//   requestAdminApi("/api/admin/schedules", { method: "POST", body: schedule });
// export const cancelAdminSchedule = (scheduleId) =>
//   requestAdminApi(`/api/admin/schedules/${encodeURIComponent(scheduleId)}`, {
//     method: "PATCH",
//     body: { status: "CANCELLED" },
//   });

// export const startAttendanceSession = ({ title, latitude, longitude }) => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to manage attendance.");
//   }
//   if (isDemoAdmin()) {
//     const activeSession = {
//       id: "demo-session",
//       title: title.trim(),
//       status: "ACTIVE",
//       created_at: new Date().toISOString(),
//       current_room_token: "4826",
//       latitude,
//       longitude,
//     };
//     localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(activeSession));
//     return Promise.resolve({
//       message: "Demo attendance session opened.",
//       session_id: activeSession.id,
//       current_room_token: activeSession.current_room_token,
//     });
//   }
//   return requestApi("/api/sessions/start", {
//     method: "POST",
//     body: { title, latitude, longitude },
//     token: session.token,
//   });
// };

// export const endAttendanceSession = (sessionId) => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to manage attendance.");
//   }
//   if (isDemoAdmin()) {
//     localStorage.removeItem(DEMO_SESSION_KEY);
//     return Promise.resolve({ message: "Demo attendance session closed." });
//   }
//   return requestApi("/api/sessions/end", {
//     method: "POST",
//     body: { session_id: sessionId },
//     token: session.token,
//   });
// };

// export const rotateAttendanceRoomToken = (sessionId) => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to manage attendance.");
//   }
//   if (isDemoAdmin()) {
//     const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
//     if (!activeSession) throw new Error("There is no active demo session to update.");
//     activeSession.current_room_token =
//       activeSession.current_room_token === "4826" ? "7351" : "4826";
//     localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(activeSession));
//     return Promise.resolve({ new_room_token: activeSession.current_room_token });
//   }
//   return requestApi("/api/sessions/rotate", {
//     method: "POST",
//     body: { session_id: sessionId },
//     token: session.token,
//   });
// };

// export const getSessionAttendance = (sessionId) => {
//   const session = getSession();
//   if (session?.role !== "admin" || !session.token) {
//     throw new Error("Sign in with an administrator account to view attendance.");
//   }
//   if (isDemoAdmin()) {
//     const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
//     if (!activeSession || activeSession.id !== sessionId) {
//       throw new Error("The demo attendance session is no longer active.");
//     }
//     return Promise.resolve({
//       total_present: DEMO_ATTENDEES.length,
//       students: DEMO_ATTENDEES,
//     });
//   }
//   return requestApi(`/api/sessions/attendance/${encodeURIComponent(sessionId)}`, {
//     token: session.token,
//   });
// };

// export const getSession = () => {
//   try {
//     const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
//     if (session?.role === "admin" && session.token) return session;
//     if (typeof session === "string") {
//       const payload = session.split(".")[1];
//       if (!payload) return null;
//       const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
//       const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
//       const claims = JSON.parse(new TextDecoder().decode(bytes));
//       const profile = claims.user_metadata;
//       if (claims.role === "authenticated" && profile?.roll_number) {
//         return {
//           name: profile.full_name || "Student",
//           studentId: profile.roll_number,
//           email: claims.email || "",
//           domain: profile.domain || "",
//           year: profile.academic_year || "",
//           github: profile.github_handle || "",
//           role: "student",
//           token: session,
//         };
//       }
//       return null;
//     }
//   } catch {
//     localStorage.removeItem(SESSION_KEY);
//   }
//   return null;
// };
// export const logout = () => localStorage.removeItem(SESSION_KEY);




const SESSION_KEY = "sa_session";
const DEMO_SESSION_KEY = "netra_demo_active_session";
// Local dev falls back to localhost; production builds fall back to the deployed
// Render backend, so the live site still works if the Vercel variable is missing.
const DEFAULT_API_URL = import.meta.env.DEV
  ? "http://localhost:5000"
  : "https://cognis-backend-api.onrender.com";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL).replace(/\/+$/, "");
const DEMO_ADMIN_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
const DEMO_ADMIN_EMAIL = "admin@cognis.test";
const DEMO_ADMIN_PASSWORD = "cognis-demo";
const LEGACY_DEMO_ADMIN_EMAIL = "admin@netra.test";
const LEGACY_DEMO_ADMIN_PASSWORD = "netra-demo";
const DEMO_ATTENDEES = [
  { roll_number: "2512056", name: "Ashutosh", status: "PRESENT", time_logged: "09:02 AM" },
  { roll_number: "2512093", name: "Harsh Tomar", status: "PRESENT", time_logged: "09:04 AM" },
  { roll_number: "2511503", name: "Ambesh Sharma", status: "PRESENT", time_logged: "09:05 AM" },
  { roll_number: "2520041", name: "Rashi Sharma", status: "PRESENT", time_logged: "09:08 AM" },
  { roll_number: "2500243", name: "Ritvik Rai", status: "PRESENT", time_logged: "09:11 AM" },
];

// The backend accepts 15-20 liveness frames per check-in.
const MAX_CHECKIN_FRAMES = 20;
// A new room code is requested when the current one has less than this left.
const ROOM_CODE_REFRESH_MS = 8_000;
const FEATURE_UNAVAILABLE = {
  friends: "Friends are not available on this server yet.",
  google: "Google sign-in is not available on this server. Use your student number and password.",
  photo: "Profile photos are not supported by this server yet.",
};
const REASON_LABELS = {
  OUTSIDE_RADIUS: "Outside the lab area",
  LIVENESS_FAILED: "Liveness check failed",
  FACE_MISMATCH: "Face did not match",
  LOW_CONFIDENCE: "Low-confidence match",
};

if (localStorage.getItem("sa_users")) {
  localStorage.removeItem("sa_users");
}

/* ---------- small helpers ---------- */

const pad = (value) => String(value).padStart(2, "0");

// "YYYY-MM-DD" in the viewer's local time zone (date-only strings pass through unchanged).
const localDay = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const decodeJwtPayload = (token) => {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

// Evenly pick `count` frames so a 24-frame scan fits the backend's 15-20 frame limit.
const pickFrames = (frames, count) => {
  if (!Array.isArray(frames) || frames.length <= count) return frames;
  return Array.from({ length: count }, (_, index) =>
    frames[Math.round((index * (frames.length - 1)) / (count - 1))],
  );
};

// Backend history rows -> the records the pages draw ("Not marked" rows are still open sessions).
const toRecords = (rows = []) =>
  rows
    .filter((row) => row.status !== "Not marked")
    .map((row, index) => ({
      id: row.id || row.session_id || `${row.starts_at}-${index}`,
      date: localDay(row.starts_at),
      event: row.title || "Session",
      status: row.status === "Present" ? "Present" : row.status === "Pending" ? "Pending" : "Absent",
    }));

const githubUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://github.com/${text.replace(/^@/, "")}`;
};
const githubHandle = (value) =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");

// The server requires full URLs; people often type "linkedin.com/in/me", so add https:// when missing.
const withHttps = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const mapProfile = (member = {}) => ({
  year: member.year || "",
  domain: member.domain || "",
  github: githubUrl(member.github_handle),
  linkedin: member.linkedin_url || "",
  instagram: member.instagram_url || "",
  about: member.bio || "",
  skills: Array.isArray(member.skills) ? member.skills.join(", ") : member.skills || "",
  photo: "",
});

/* ---------- sessions (login) ---------- */

const saveSession = (result) => {
  const member = result?.member;
  if (!result?.token || !member?.id || !member.role) {
    throw new Error("The server returned an invalid sign-in response.");
  }
  const user = {
    token: result.token,
    id: member.id,
    role: member.role === "admin" ? "admin" : "student",
    studentId: member.roll_number,
    name: member.full_name,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const getSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.token) {
      if (session) localStorage.removeItem(SESSION_KEY); // old format from a previous version
      return null;
    }
    if (session.demo) return session;
    const expiresAt = decodeJwtPayload(session.token)?.exp;
    if (expiresAt && expiresAt * 1000 <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};
export const logout = () => localStorage.removeItem(SESSION_KEY);

/* ---------- HTTP ---------- */

async function requestApi(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        import.meta.env.DEV
          ? `Cannot reach the attendance server at ${API_BASE_URL}. Start the backend with "npm --prefix backend start" and check VITE_API_BASE_URL.`
          : `Cannot reach the attendance server at ${API_BASE_URL}. It may be waking up (this can take up to a minute on the free plan), or the backend's CORS settings may not allow this site. Please try again shortly.`,
      );
    }
    throw error;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The attendance server returned an invalid response. Check that the backend is running correctly.");
  }
  if (response.status === 401 && token) {
    const session = getSession();
    if (session?.token === token) localStorage.removeItem(SESSION_KEY);
  }
  if (!response.ok) {
    const detail = Array.isArray(result.details) && result.details.length
      ? ` (${result.details.map((item) => `${item.field}: ${item.message}`).join("; ")})`
      : "";
    throw new Error((result.error || "The request could not be completed.") + detail);
  }
  return result;
}

const requireSession = (role, message) => {
  const session = getSession();
  if (session?.role !== role || !session.token) throw new Error(message);
  return session;
};

const requestStudentApi = async (path, options = {}) => {
  const session = requireSession("student", "Sign in with a student account to continue.");
  return requestApi(path, { ...options, token: session.token });
};

const isDemoAdmin = () => DEMO_ADMIN_ENABLED && getSession()?.demo === true;

const requestAdminApi = async (path, options = {}) => {
  const session = requireSession("admin", "Sign in with an administrator account to continue.");
  if (isDemoAdmin()) {
    throw new Error("This admin workflow requires the backend; demo mode only supports portal controls and sample members.");
  }
  return requestApi(path, { ...options, token: session.token });
};

/* ---------- sign in / register / password reset ---------- */

export async function loginUser({ studentId, password }) {
  const result = await requestApi("/api/auth/login", {
    method: "POST",
    body: { roll_number: String(studentId).trim(), password },
  });
  return saveSession(result);
}

export async function registerUser(details) {
  await requestApi("/api/auth/register", {
    method: "POST",
    body: {
      roll_number: details.roll_number,
      full_name: details.full_name,
      email: details.email,
      password: details.password,
      domain: details.domain,
      year: details.academic_year,
      consent: details.consent === true,
      frames: details.baseline_frames_base64,
    },
  });
  // The backend creates the account but does not sign the student in.
  return loginUser({ studentId: details.roll_number, password: details.password });
}

export async function loginWithGoogle() {
  throw new Error(FEATURE_UNAVAILABLE.google);
}

// Step 1: the server emails a 6-digit code (valid for 2 minutes).
export const requestPasswordReset = (rollNumber) =>
  requestApi("/api/auth/forgot", { method: "POST", body: { roll_number: rollNumber } });

// Step 2: exchange the code for a reset token, then set the new password.
export const completePasswordReset = async ({ rollNumber, code, password }) => {
  const { reset_token: resetToken } = await requestApi("/api/auth/verify-otp", {
    method: "POST",
    body: { roll_number: rollNumber, code },
  });
  return requestApi("/api/auth/reset-password", {
    method: "POST",
    body: { reset_token: resetToken, new_password: password },
  });
};

export async function loginAdmin({ identifier, password }) {
  if (DEMO_ADMIN_ENABLED) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const isCurrentDemoLogin =
      normalizedIdentifier === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD;
    const isLegacyDemoLogin =
      normalizedIdentifier === LEGACY_DEMO_ADMIN_EMAIL && password === LEGACY_DEMO_ADMIN_PASSWORD;
    if (!isCurrentDemoLogin && !isLegacyDemoLogin) {
      throw new Error("Incorrect demo admin login or password.");
    }
    const demoUser = {
      name: "Demo Administrator",
      email: DEMO_ADMIN_EMAIL,
      role: "admin",
      token: "development-demo-token",
      demo: true,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    return demoUser;
  }

  // Admins are ordinary members whose role was set to "admin"; they sign in with their student number.
  const result = await requestApi("/api/auth/login", {
    method: "POST",
    body: { roll_number: identifier.trim(), password },
  });
  if (result?.member?.role !== "admin") {
    throw new Error("This account does not have administrator access.");
  }
  return saveSession(result);
}

/* ---------- student: attendance session + check-in ---------- */

const getDemoActiveSession = () => {
  const session = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
  return { active: Boolean(session), session };
};

export const getActiveAttendanceSession = async () => {
  if (DEMO_ADMIN_ENABLED) return getDemoActiveSession();
  const session = getSession();
  if (!session?.token) throw new Error("Sign in to check whether attendance is open.");
  const result = await requestApi("/api/sessions/active", { token: session.token });
  return { active: Boolean(result.session), session: result.session };
};

export const checkInForAttendance = async (details) => {
  const result = await requestApi("/api/attendance/checkin", {
    method: "POST",
    token: getSession()?.token,
    body: {
      session_id: details.session_id,
      room_token: details.room_token,
      latitude: details.latitude,
      longitude: details.longitude,
      frames: pickFrames(details.live_frames_base64, MAX_CHECKIN_FRAMES),
    },
  });
  // The page expects PRESENT plus a review flag when an admin still has to confirm.
  return {
    status: "PRESENT",
    review_status: result.status === "PENDING_REVIEW" ? "PENDING" : "APPROVED",
    message: result.message,
  };
};

/* ---------- student: dashboard, analytics, profile, friends ---------- */

export const getMyHome = async () => {
  const [home, analytics] = await Promise.all([
    requestStudentApi("/api/me/home"),
    requestStudentApi("/api/me/analytics"),
  ]);
  return {
    attendance: toRecords(analytics.records),
    events: (home.upcoming_events?.items || []).map((event) => ({
      id: event.id,
      title: event.title,
      date: localDay(event.event_date),
    })),
    summary: {
      attendedClasses: home.overall?.present ?? 0,
      totalClasses: home.overall?.total ?? 0,
      presentToday: home.today?.present ?? 0,
      totalToday: home.today?.total ?? 0,
      friendsCount: 0,
    },
  };
};

export const getMyAnalytics = async () => {
  const result = await requestStudentApi("/api/me/analytics");
  return {
    attendance: toRecords(result.records),
    summary: {
      attendedClasses: result.overall?.present ?? 0,
      totalClasses: result.overall?.total ?? 0,
    },
  };
};

export const getMyProfile = async () => {
  const result = await requestStudentApi("/api/me/profile");
  return { profile: mapProfile(result.member) };
};

export const updateMyProfile = async (profile) => {
  if (profile.profile_photo_base64) throw new Error(FEATURE_UNAVAILABLE.photo);
  const skills = String(profile.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean);
  const changes = {
    domain: profile.domain,
    year: profile.academic_year,
    github_handle: githubHandle(profile.github_handle),
    linkedin_url: withHttps(profile.linkedin_url),
    instagram_url: withHttps(profile.instagram_url),
    bio: profile.about,
    skills, // the server stores skills as a list
  };
  // Empty values are left out so the server's validation does not reject blank fields.
  const body = Object.fromEntries(
    Object.entries(changes).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined && String(value).trim() !== "",
    ),
  );
  const result = await requestStudentApi("/api/me/profile", { method: "PATCH", body });
  return { profile: mapProfile(result.member) };
};

export const getMyFriends = async () => {
  throw new Error(FEATURE_UNAVAILABLE.friends);
};
export const sendFriendRequest = async () => {
  throw new Error(FEATURE_UNAVAILABLE.friends);
};
export const respondToFriendRequest = async () => {
  throw new Error(FEATURE_UNAVAILABLE.friends);
};

/* ---------- admin: portal control ---------- */

let lastRoomCodeRefresh = 0;

export const getAdminActiveAttendanceSession = async () => {
  const session = requireSession("admin", "Sign in with an administrator account to manage attendance.");
  if (isDemoAdmin()) return getDemoActiveSession();
  const result = await requestApi("/api/sessions/active", { token: session.token });
  const active = result.session;
  if (!active) return { active: false, session: null };

  // Room codes expire quickly on the server, so keep a fresh one available while the portal is open.
  let roomCode = active.room_token;
  const msLeft = active.token_expires_at ? new Date(active.token_expires_at).getTime() - Date.now() : 0;
  if (!roomCode || (msLeft < ROOM_CODE_REFRESH_MS && Date.now() - lastRoomCodeRefresh > 10_000)) {
    const rotated = await requestApi("/api/sessions/rotate", {
      method: "POST",
      body: { session_id: active.id },
      token: session.token,
    });
    lastRoomCodeRefresh = Date.now();
    roomCode = rotated.room_token;
  }
  return {
    active: true,
    session: {
      id: active.id,
      title: active.title,
      status: "ACTIVE",
      created_at: active.starts_at,
      current_room_token: roomCode,
    },
  };
};

export const startAttendanceSession = async ({ title, latitude, longitude }) => {
  const session = requireSession("admin", "Sign in with an administrator account to manage attendance.");
  if (isDemoAdmin()) {
    const activeSession = {
      id: "demo-session",
      title: title.trim(),
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      current_room_token: "4826",
      latitude,
      longitude,
    };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(activeSession));
    return {
      message: "Demo attendance session opened.",
      session_id: activeSession.id,
      current_room_token: activeSession.current_room_token,
    };
  }
  // Only send real numbers: the server would read null/"" as 0 and put the session at 0°, 0°.
  const location = {};
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    location.latitude = latitude;
    location.longitude = longitude;
  }
  const result = await requestApi("/api/sessions/start", {
    method: "POST",
    body: { title: String(title).trim(), ...location },
    token: session.token,
  });
  lastRoomCodeRefresh = Date.now();
  return { ...result, current_room_token: result.room_token };
};

export const endAttendanceSession = async (sessionId) => {
  const session = requireSession("admin", "Sign in with an administrator account to manage attendance.");
  if (isDemoAdmin()) {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return { message: "Demo attendance session closed." };
  }
  return requestApi("/api/sessions/end", {
    method: "POST",
    body: { session_id: sessionId },
    token: session.token,
  });
};

export const rotateAttendanceRoomToken = async (sessionId) => {
  const session = requireSession("admin", "Sign in with an administrator account to manage attendance.");
  if (isDemoAdmin()) {
    const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
    if (!activeSession) throw new Error("There is no active demo session to update.");
    activeSession.current_room_token =
      activeSession.current_room_token === "4826" ? "7351" : "4826";
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(activeSession));
    return { new_room_token: activeSession.current_room_token };
  }
  const result = await requestApi("/api/sessions/rotate", {
    method: "POST",
    body: { session_id: sessionId },
    token: session.token,
  });
  lastRoomCodeRefresh = Date.now();
  return { new_room_token: result.room_token };
};

export const getSessionAttendance = async (sessionId) => {
  const session = requireSession("admin", "Sign in with an administrator account to view attendance.");
  if (isDemoAdmin()) {
    const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error("The demo attendance session is no longer active.");
    }
    return { total_present: DEMO_ATTENDEES.length, students: DEMO_ATTENDEES };
  }
  const result = await requestApi(`/api/sessions/${encodeURIComponent(sessionId)}/attendance`, {
    token: session.token,
  });
  const students = (result.students || [])
    .filter((student) => student.status === "PRESENT")
    .map((student) => ({
      ...student,
      name: student.full_name,
      time_logged: student.time_logged
        ? new Date(student.time_logged).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "",
    }));
  return { total_present: students.length, students };
};

export const getAdminMembers = async () => {
  const session = requireSession("admin", "Sign in with an administrator account to view the student directory.");
  if (isDemoAdmin()) {
    return {
      members: DEMO_ATTENDEES.map(({ roll_number, name }) => ({ roll_number, full_name: name })),
    };
  }
  return requestApi("/api/admin/members", { token: session.token });
};

/* ---------- admin: review queue, flags, analytics ---------- */

const MAX_REVIEW_CARDS = 25;

export const getAdminReviews = async () => {
  const { alerts = [] } = await requestAdminApi("/api/admin/alerts?reviewed=false");
  const shown = alerts.slice(0, MAX_REVIEW_CARDS);
  // The list leaves out the photo, so each alert is opened to fetch its evidence image.
  const details = await Promise.all(
    shown.map((alert) =>
      requestAdminApi(`/api/admin/alerts/${encodeURIComponent(alert.id)}`)
        .then((result) => result.alert)
        .catch(() => null),
    ),
  );
  return {
    reviews: shown.map((alert, index) => {
      const image = details[index]?.image_base64;
      return {
        id: alert.id,
        photo_url: image ? (String(image).startsWith("data:") ? image : `data:image/jpeg;base64,${image}`) : "",
        student: { full_name: alert.members?.full_name, roll_number: alert.members?.roll_number },
        session: { title: alert.sessions?.title },
        created_at: alert.created_at,
        flagged: true,
        flag_reason: `${REASON_LABELS[alert.reason] || alert.reason}${alert.details ? ` (${alert.details})` : ""}`,
      };
    }),
  };
};

export const reviewAttendance = (alertId, decision) =>
  requestAdminApi(`/api/admin/alerts/${encodeURIComponent(alertId)}/review`, {
    method: "POST",
    body: { decision: decision === "APPROVED" ? "approve" : "reject" },
  });

export const getAdminFlags = async () => {
  const { flags = [] } = await requestAdminApi("/api/admin/flags");
  const byMember = new Map();
  flags.forEach((flag) => {
    const member = flag.members;
    if (!member) return;
    const entry = byMember.get(member.id) || {
      id: member.id, // flags are cleared per member
      student: { full_name: member.full_name, roll_number: member.roll_number },
      session: { title: "Member flag" },
      photo_url: "",
      reasons: [],
    };
    entry.reasons.push(flag.reason);
    byMember.set(member.id, entry);
  });
  return {
    flags: [...byMember.values()].map(({ reasons, ...entry }) => ({
      ...entry,
      flag_reason: reasons.join(" · "),
    })),
  };
};

// `memberId` is the member's id (flags belong to members on this backend).
export const setAttendanceFlag = (memberId, flagged, reason = "") =>
  requestAdminApi(`/api/admin/members/${encodeURIComponent(memberId)}/${flagged ? "flag" : "unflag"}`, {
    method: "POST",
    ...(flagged ? { body: { reason: String(reason).trim() } } : {}),
  });

// The review queue knows a student's number, not their member id, so look the member up first.
export const flagStudent = async (rollNumber, reason) => {
  const { members = [] } = await requestAdminApi(`/api/admin/members?search=${encodeURIComponent(rollNumber)}`);
  const member = members.find((item) => item.roll_number === rollNumber);
  if (!member) throw new Error("Could not find that student in the member directory.");
  return setAttendanceFlag(member.id, true, reason);
};

export const getAdminAnalytics = async () => {
  const [analytics, members, alerts] = await Promise.all([
    requestAdminApi("/api/admin/analytics"),
    requestAdminApi("/api/admin/members"),
    requestAdminApi("/api/admin/alerts?reviewed=false"),
  ]);
  return {
    members: members.stats?.total ?? 0,
    sessions: analytics.total_sessions ?? 0,
    average: analytics.average_attendance_percent ?? 0,
    pending_reviews: (alerts.alerts || []).length,
    flagged: members.stats?.flagged ?? 0,
  };
};

/* ---------- admin: events and scheduled sessions ---------- */

export const getAdminEvents = async () => {
  const result = await requestAdminApi("/api/me/events"); // lists upcoming events for any signed-in user
  return {
    events: (result.events || []).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      starts_at: event.event_date,
      status: "PUBLISHED",
    })),
  };
};

export const createAdminEvent = (event) =>
  requestAdminApi("/api/admin/events", {
    method: "POST",
    body: {
      title: event.title,
      ...(event.description ? { description: event.description } : {}),
      event_date: localDay(event.starts_at),
    },
  });

export const cancelAdminEvent = (eventId) =>
  requestAdminApi(`/api/admin/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });

export const getAdminSchedules = async () => {
  const result = await requestAdminApi("/api/sessions");
  return {
    schedules: (result.sessions || [])
      .filter((session) => session.status === "SCHEDULED")
      .map((session) => ({
        id: session.id,
        title: session.title,
        scheduled_at: session.starts_at,
        status: "PENDING",
      })),
  };
};

export const createAdminSchedule = async (schedule) => {
  const result = await requestAdminApi("/api/sessions/schedule", {
    method: "POST",
    body: {
      title: schedule.title,
      starts_at: schedule.scheduled_at,
      latitude: schedule.latitude,
      longitude: schedule.longitude,
    },
  });
  return { schedule: result.session };
};

// Closing a scheduled session that never opened cancels it.
export const cancelAdminSchedule = (scheduleId) =>
  requestAdminApi("/api/sessions/end", { method: "POST", body: { session_id: scheduleId } });

export const startScheduledSession = (scheduleId) =>
  requestAdminApi("/api/sessions/start", { method: "POST", body: { session_id: scheduleId } });