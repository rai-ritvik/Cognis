const SESSION_KEY = "sa_session";
const DEMO_SESSION_KEY = "netra_demo_active_session";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const DEMO_ADMIN_ENABLED = false;
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
  const rawUser = result?.user || result?.member;
  const studentId = rawUser?.studentId || rawUser?.roll_number;
  if (!result?.token || !rawUser || !studentId) {
    throw new Error("The server returned an invalid student sign-in response.");
  }
  const user = { ...rawUser, studentId, name: rawUser.name || rawUser.full_name, role: rawUser.role === "admin" ? "admin" : "student", token: result.token };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

if (localStorage.getItem("sa_users")) {
  localStorage.removeItem("sa_users");
}

export async function registerUser(details) {
  const result = await requestApi("/api/auth/register", {
    method: "POST",
    body: { ...details, year: details.year ?? details.academic_year, frames: details.frames ?? details.baseline_frames_base64 },
  });
  return result;
}

export async function loginUser({ studentId, password }) {
  const result = await requestApi("/api/auth/login", {
    method: "POST",
    body: { roll_number: studentId, password },
  });
  return saveStudentSession(result);
}

export async function loginWithGoogle() {
  throw new Error("Google sign-in is not available yet. Please use your student number and password.");
}

export const requestPasswordReset = (rollNumber) =>
  requestApi("/api/auth/forgot", {
    method: "POST",
    body: { roll_number: String(rollNumber).trim() },
  });

export const verifyPasswordResetCode = (rollNumber, code) =>
  requestApi("/api/auth/verify-otp", {
    method: "POST",
    body: { roll_number: String(rollNumber).trim(), code: String(code).trim() },
  });

export const completePasswordReset = (accessToken, password) =>
  requestApi("/api/auth/reset-password", {
    method: "POST",
    body: { reset_token: accessToken, new_password: password },
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
  if (!response.ok) throw new Error(result.error || result.message || "The request could not be completed.");
  return result;
}


export async function loginAdmin({ rollNumber, password }) {
  const result = await requestApi("/api/auth/login", {
    method: "POST",
    body: {
      roll_number: rollNumber.trim(),
      password,
    },
  });

  // The backend returns the account as "member", not "user".
  const member = result.member || result.user;

  if (!result.token || !member || member.role !== "admin") {
    throw new Error(
      "Admin login failed. Check your student number, password, and administrator permissions."
    );
  }

  const user = {
    ...member,
    studentId: member.roll_number || rollNumber.trim(),
    name: member.full_name || member.name || "Administrator",
    role: member.role,
    token: result.token,
  };

  localStorage.setItem("sa_session", JSON.stringify(user));
  return user;
}

const getDemoActiveSession = () => {
  const session = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || "null");
  return { active: Boolean(session), session };
};

const isDemoAdmin = () => DEMO_ADMIN_ENABLED && getSession()?.demo === true;

export const getActiveAttendanceSession = async () => {
  if (DEMO_ADMIN_ENABLED) return getDemoActiveSession();
  const result = await requestApi("/api/sessions/active", { token: getSession()?.token });
  return { active: Boolean(result.session), session: result.session || null };
};

export const checkInForAttendance = (details) =>
  requestApi("/api/attendance/checkin", {
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

const toUiAttendance = (record) => ({
  id: record.session_id || record.id,
  session_id: record.session_id || record.id,
  event: record.title || record.event || "Attendance session",
  date: String(record.starts_at || record.date || "").slice(0, 10),
  status: record.status === "Present" || record.status === "PRESENT"
    ? "Present"
    : record.status === "Pending" || record.status === "PENDING_REVIEW"
      ? "Pending"
      : record.status === "Not marked"
        ? "Not marked"
        : "Absent",
});

export const getMyHome = async () => {
  const [home, analytics] = await Promise.all([
    requestStudentApi("/api/me/home"),
    requestStudentApi("/api/me/analytics"),
  ]);
  const attendance = (analytics.records || []).map(toUiAttendance);
  const overall = analytics.overall || home.overall || {};
  const today = home.today || {};
  return {
    ...home,
    attendance,
    events: (home.upcoming_events?.items || []).map((event) => ({
      ...event,
      date: event.event_date || event.date || "",
    })),
    summary: {
      attendedClasses: overall.present || 0,
      totalClasses: overall.total || 0,
      presentToday: today.present || 0,
      totalToday: today.total || 0,
      friendsCount: 0,
    },
  };
};

export const getMyAnalytics = async () => {
  const result = await requestStudentApi("/api/me/analytics");
  const allRecords = (result.records || []).map(toUiAttendance);
  const attendance = allRecords.filter((record) => ["Present", "Absent"].includes(record.status));
  return {
    ...result,
    attendance,
    summary: {
      attendedClasses: result.overall?.present || 0,
      totalClasses: (result.overall?.present || 0) + (result.overall?.absent || 0),
    },
  };
};

const normalizeProfileResponse = (result) => {
  const member = result?.profile || result?.member;

  // If the server didn't return profile data, don't crash.
  if (!member) {
    throw new Error("The server did not return profile information.");
  }

  return {
    ...result,
    profile: {
      ...member,
      year: member.year || member.academic_year || "",
      domain: member.domain || "",
      github: member.github || member.github_handle || "",
      linkedin: member.linkedin || member.linkedin_url || "",
      instagram: member.instagram || member.instagram_url || "",
      about: member.about || member.bio || "",
      skills: Array.isArray(member.skills)
        ? member.skills.join(", ")
        : member.skills || "",
      photo: member.photo || member.profile_photo_url || member.profile_photo_base64 || "",
    },
  };
};

export const getMyProfile = () =>
  requestStudentApi("/api/me/profile").then(normalizeProfileResponse);

export const updateMyProfile = (profile) =>
  requestStudentApi("/api/me/profile", {
    method: "PATCH",
    body: {
      ...(profile.about !== undefined ? { bio: profile.about } : {}),
      ...(profile.profile_photo_base64 !== undefined ? { profile_photo_base64: profile.profile_photo_base64 } : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
      ...(profile.skills !== undefined ? {
        skills: (Array.isArray(profile.skills) ? profile.skills : String(profile.skills).split(","))
          .map((skill) => String(skill).trim()).filter(Boolean),
      } : {}),
      ...((profile.github_handle ?? profile.github) ? { github_handle: profile.github_handle ?? profile.github } : {}),
      ...((profile.linkedin_url ?? profile.linkedin) ? { linkedin_url: profile.linkedin_url ?? profile.linkedin } : {}),
      ...((profile.instagram_url ?? profile.instagram) ? { instagram_url: profile.instagram_url ?? profile.instagram } : {}),
    },
  }).then(normalizeProfileResponse);

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
  return requestApi("/api/sessions/active", { token: session.token }).then((result) => ({
    active: Boolean(result.session),
    session: result.session ? { ...result.session, current_room_token: result.session.room_token } : null,
  }));
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
  return requestApi("/api/admin/members", { token: session.token });
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

export const getAdminReviews = () => requestAdminApi("/api/admin/alerts").then((result) => ({ reviews: (result.alerts || []).map((alert) => ({ ...alert, member: alert.members, student: alert.members, session: alert.sessions, reason: alert.reason })) }));
export const reviewAttendance = (alertId, decision, reason = "") =>
  requestAdminApi(`/api/admin/alerts/${encodeURIComponent(alertId)}/review`, {
    method: "POST",
    body: { decision: ["approve", "approved"].includes(String(decision).toLowerCase()) ? "approve" : "reject" },
  });
export const getAdminFlags = () => requestAdminApi("/api/admin/flags").then((result) => ({ flags: (result.flags || []).map((flag) => ({ ...flag, member: flag.members, student: flag.members, flag_reason: flag.reason })) }));
export const setAttendanceFlag = (memberId, flagged, reason = "") =>
  requestAdminApi(`/api/admin/members/${encodeURIComponent(memberId)}/${flagged ? "flag" : "unflag"}`, {
    method: "POST",
    ...(flagged ? { body: { reason: reason || "Flagged for administrator review" } } : {}),
  });
export const getAdminAnalytics = () => requestAdminApi("/api/admin/analytics").then((result) => ({
  ...result,
  members: result.total_members ?? result.members ?? 0,
  sessions: result.total_sessions ?? result.sessions ?? 0,
  present: result.present_checkins ?? result.present ?? 0,
  pending_reviews: result.pending_reviews ?? 0,
  flagged: result.flagged ?? 0,
}));
export const getAdminEvents = () => requestAdminApi("/api/admin/events").then((result) => ({
  events: (result.events || []).map((event) => ({
    ...event,
    starts_at: event.starts_at || (event.event_date ? `${event.event_date}T00:00:00` : null),
    status: event.status || "PUBLISHED",
  })),
}));
export const createAdminEvent = (event) =>
  requestAdminApi("/api/admin/events", {
    method: "POST",
    body: {
      title: event.title,
      description: event.description,
      event_date: String(event.event_date || event.starts_at || "").slice(0, 10),
    },
  });
export const cancelAdminEvent = (eventId) =>
  requestAdminApi(`/api/admin/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
export const getAdminSchedules = () => requestAdminApi("/api/sessions").then((result) => ({ schedules: (result.sessions || []).map((session) => ({ ...session, scheduled_at: session.starts_at, status: session.status === "SCHEDULED" ? "PENDING" : session.status })) }));
export const createAdminSchedule = (schedule) =>
  requestAdminApi("/api/sessions/schedule", { method: "POST", body: { title: schedule.title, starts_at: schedule.starts_at || schedule.scheduled_at, latitude: schedule.latitude, longitude: schedule.longitude, radius_m: schedule.radius_m } }).then((result) => ({ schedule: { ...result.session, scheduled_at: result.session?.starts_at, status: result.session?.status === "SCHEDULED" ? "PENDING" : result.session?.status } }));
export const cancelAdminSchedule = (scheduleId) =>
  requestAdminApi("/api/sessions/end", {
    method: "POST",
    body: { session_id: scheduleId },
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
  }).then((result) => ({ ...result, current_room_token: result.room_token }));
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
  }).then((result) => ({ ...result, new_room_token: result.room_token }));
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
  return requestApi(`/api/sessions/${encodeURIComponent(sessionId)}/attendance`, {
    token: session.token,
  });
};

export const getSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session && typeof session === "object" && session.token && ["admin", "student"].includes(session.role)) return session;
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
