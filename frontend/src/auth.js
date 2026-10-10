const SESSION_KEY = "sa_session";
const DEMO_SESSION_KEY = "netra_demo_active_session";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
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

const saveStudentSession = (result) => {
  if (!result?.token || result.user?.role !== "student" || !result.user.studentId) {
    throw new Error("The server returned an invalid student sign-in response.");
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(result.token));
  return { ...result.user, token: result.token };
};

if (localStorage.getItem("sa_users")) {
  localStorage.removeItem("sa_users");
}

export async function registerUser(details) {
  const result = await requestApi("/api/auth/register", {
    method: "POST",
    body: details,
  });
  return saveStudentSession(result);
}

export async function loginUser({ studentId, password }) {
  const result = await requestApi("/api/auth/login", {
    method: "POST",
    body: { identifier: studentId, password },
  });
  return saveStudentSession(result);
}

export async function loginWithGoogle(credential) {
  const result = await requestApi("/api/auth/google", {
    method: "POST",
    body: { credential },
  });
  return saveStudentSession(result);
}

export const requestPasswordReset = (identifier) =>
  requestApi("/api/auth/password/reset-request", {
    method: "POST",
    body: { identifier },
  });

export const completePasswordReset = (accessToken, password) =>
  requestApi("/api/auth/password/reset", {
    method: "POST",
    body: { access_token: accessToken, password },
  });

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
      throw new Error(`Cannot reach the attendance server at ${API_BASE_URL}. Start the backend with "npm --prefix backend start" and check VITE_API_BASE_URL.`);
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
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

export async function loginAdmin({ email, password }) {
  if (DEMO_ADMIN_ENABLED) {
    const normalizedEmail = email.trim().toLowerCase();
    const isCurrentDemoLogin =
      normalizedEmail === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD;
    const isLegacyDemoLogin =
      normalizedEmail === LEGACY_DEMO_ADMIN_EMAIL && password === LEGACY_DEMO_ADMIN_PASSWORD;
    if (
      !isCurrentDemoLogin &&
      !isLegacyDemoLogin
    ) {
      throw new Error("Incorrect demo admin email or password.");
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

  const result = await requestApi("/api/auth/admin/login", {
    method: "POST",
    body: { email, password },
  });
  if (!result.token || result.user?.role !== "admin") {
    throw new Error("The server returned an invalid admin sign-in response.");
  }
  const user = { ...result.user, token: result.token };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

const getDemoActiveSession = () => {
  const session = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
  return { active: Boolean(session), session };
};

const isDemoAdmin = () => DEMO_ADMIN_ENABLED && getSession()?.demo === true;

export const getActiveAttendanceSession = () =>
  DEMO_ADMIN_ENABLED ? Promise.resolve(getDemoActiveSession()) : requestApi("/api/sessions/active");

export const checkInForAttendance = (details) =>
  requestApi("/api/checkin", {
    method: "POST",
    body: details,
    token: getSession()?.token,
  });

const requestStudentApi = (path, options = {}) => {
  const session = getSession();
  if (session?.role !== "student" || !session.token) {
    throw new Error("Sign in with a student account to continue.");
  }
  return requestApi(path, { ...options, token: session.token });
};

export const getMyHome = () => requestStudentApi("/api/me/home");
export const getMyAnalytics = () => requestStudentApi("/api/me/analytics");
export const getMyProfile = () => requestStudentApi("/api/me/profile");
export const updateMyProfile = (profile) =>
  requestStudentApi("/api/me/profile", { method: "PATCH", body: profile });
export const getMyFriends = () => requestStudentApi("/api/me/friends");
export const sendFriendRequest = (rollNumber) =>
  requestStudentApi("/api/me/friends", {
    method: "POST",
    body: { roll_number: rollNumber },
  });
export const respondToFriendRequest = (requestId, status) =>
  requestStudentApi(`/api/me/friends/requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: { status },
  });

export const getAdminActiveAttendanceSession = () => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to manage attendance.");
  }
  if (isDemoAdmin()) return Promise.resolve(getDemoActiveSession());
  return requestApi("/api/sessions/active/admin", { token: session.token });
};

export const getAdminMembers = () => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to view the student directory.");
  }
  if (isDemoAdmin()) {
    return Promise.resolve({
      members: DEMO_ATTENDEES.map(({ roll_number, name }) => ({
        roll_number,
        full_name: name,
      })),
    });
  }
  return requestApi("/api/members", { token: session.token });
};

const requestAdminApi = (path, options = {}) => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to continue.");
  }
  if (isDemoAdmin()) {
    throw new Error("This admin workflow requires the backend; demo mode only supports portal controls and sample members.");
  }
  return requestApi(path, { ...options, token: session.token });
};

export const getAdminReviews = () => requestAdminApi("/api/admin/reviews");
export const reviewAttendance = (attendanceId, decision, reason = "") =>
  requestAdminApi(`/api/admin/reviews/${encodeURIComponent(attendanceId)}`, {
    method: "PATCH",
    body: { decision, reason },
  });
export const getAdminFlags = () => requestAdminApi("/api/admin/flags");
export const setAttendanceFlag = (attendanceId, flagged, reason = "") =>
  requestAdminApi(`/api/admin/flags/${encodeURIComponent(attendanceId)}`, {
    method: "PATCH",
    body: { flagged, reason },
  });
export const getAdminAnalytics = () => requestAdminApi("/api/admin/analytics");
export const getAdminEvents = () => requestAdminApi("/api/admin/events");
export const createAdminEvent = (event) =>
  requestAdminApi("/api/admin/events", { method: "POST", body: event });
export const cancelAdminEvent = (eventId) =>
  requestAdminApi(`/api/admin/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: { status: "CANCELLED" },
  });
export const getAdminSchedules = () => requestAdminApi("/api/admin/schedules");
export const createAdminSchedule = (schedule) =>
  requestAdminApi("/api/admin/schedules", { method: "POST", body: schedule });
export const cancelAdminSchedule = (scheduleId) =>
  requestAdminApi(`/api/admin/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "PATCH",
    body: { status: "CANCELLED" },
  });

export const startAttendanceSession = ({ title, latitude, longitude }) => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to manage attendance.");
  }
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
    return Promise.resolve({
      message: "Demo attendance session opened.",
      session_id: activeSession.id,
      current_room_token: activeSession.current_room_token,
    });
  }
  return requestApi("/api/sessions/start", {
    method: "POST",
    body: { title, latitude, longitude },
    token: session.token,
  });
};

export const endAttendanceSession = (sessionId) => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to manage attendance.");
  }
  if (isDemoAdmin()) {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return Promise.resolve({ message: "Demo attendance session closed." });
  }
  return requestApi("/api/sessions/end", {
    method: "POST",
    body: { session_id: sessionId },
    token: session.token,
  });
};

export const rotateAttendanceRoomToken = (sessionId) => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to manage attendance.");
  }
  if (isDemoAdmin()) {
    const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
    if (!activeSession) throw new Error("There is no active demo session to update.");
    activeSession.current_room_token =
      activeSession.current_room_token === "4826" ? "7351" : "4826";
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(activeSession));
    return Promise.resolve({ new_room_token: activeSession.current_room_token });
  }
  return requestApi("/api/sessions/rotate", {
    method: "POST",
    body: { session_id: sessionId },
    token: session.token,
  });
};

export const getSessionAttendance = (sessionId) => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to view attendance.");
  }
  if (isDemoAdmin()) {
    const activeSession = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error("The demo attendance session is no longer active.");
    }
    return Promise.resolve({
      total_present: DEMO_ATTENDEES.length,
      students: DEMO_ATTENDEES,
    });
  }
  return requestApi(`/api/sessions/attendance/${encodeURIComponent(sessionId)}`, {
    token: session.token,
  });
};

export const getSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.role === "admin" && session.token) return session;
    if (typeof session === "string") {
      const payload = session.split(".")[1];
      if (!payload) return null;
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const claims = JSON.parse(new TextDecoder().decode(bytes));
      const profile = claims.user_metadata;
      if (claims.role === "authenticated" && profile?.roll_number) {
        return {
          name: profile.full_name || "Student",
          studentId: profile.roll_number,
          email: claims.email || "",
          domain: profile.domain || "",
          year: profile.academic_year || "",
          github: profile.github_handle || "",
          role: "student",
          token: session,
        };
      }
      return null;
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return null;
};
export const logout = () => localStorage.removeItem(SESSION_KEY);
