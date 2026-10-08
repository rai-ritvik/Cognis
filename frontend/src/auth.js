// Temporary localStorage auth. Replace the bodies with your real API calls later.
const USERS_KEY = "sa_users";
const SESSION_KEY = "sa_session";
const DEMO_SESSION_KEY = "netra_demo_active_session";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const DEMO_ADMIN_ENABLED = import.meta.env.DEV;
const DEMO_ADMIN_EMAIL = "admin@netra.test";
const DEMO_ADMIN_PASSWORD = "netra-demo";
const DEMO_ATTENDEES = [
  { roll_number: "2512056", name: "Ashutosh", status: "PRESENT", time_logged: "09:02 AM" },
  { roll_number: "2512093", name: "Harsh Tomar", status: "PRESENT", time_logged: "09:04 AM" },
  { roll_number: "2511503", name: "Ambesh Sharma", status: "PRESENT", time_logged: "09:05 AM" },
  { roll_number: "2520041", name: "Rashi Sharma", status: "PRESENT", time_logged: "09:08 AM" },
  { roll_number: "2500243", name: "Ritvik Rai", status: "PRESENT", time_logged: "09:11 AM" },
];

const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
const normalizeStudentId = (studentId) => studentId.trim().toLowerCase();

export function registerUser({ name, studentId, email, password }) {
  const users = getUsers();
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedStudentId) {
    throw new Error("Enter your student number.");
  }
  if (users.some((u) => u.studentId && normalizeStudentId(u.studentId) === normalizedStudentId)) {
    throw new Error("This student number is already registered. Please log in.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);
  if (existingUser && !existingUser.studentId) {
    if (existingUser.password !== password) {
      throw new Error("Enter your current password to add your student number.");
    }
    const upgradedUser = { ...existingUser, studentId: normalizedStudentId };
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify(users.map((user) => user === existingUser ? upgradedUser : user))
    );
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ name: upgradedUser.name, studentId: upgradedUser.studentId, email: upgradedUser.email, role: "student" })
    );
    return upgradedUser;
  }
  if (existingUser) {
    throw new Error("This email is already registered. Please log in.");
  }

  const user = { name, studentId: normalizedStudentId, email: normalizedEmail, password };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name, studentId: user.studentId, email: user.email, role: "student" })); // auto login
  return user;
}

export function loginUser({ studentId, password }) {
  const loginIdentifier = studentId.trim().toLowerCase();
  const user = getUsers().find(
    (u) => (
      (u.studentId && normalizeStudentId(u.studentId) === loginIdentifier) ||
      u.email?.trim().toLowerCase() === loginIdentifier
    ) && u.password === password
  );
  if (!user) throw new Error("Incorrect student number or password.");
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, studentId: user.studentId, email: user.email, role: "student" }));
  return user;
}

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
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

export async function loginWithGoogle(credential) {
  const result = await requestApi("/api/auth/google", {
    method: "POST",
    body: { credential },
  });
  if (!result.user?.email) {
    throw new Error("The server returned an invalid Google sign-in response.");
  }
  const user = { ...result.user, role: "student" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function loginAdmin({ email, password }) {
  if (DEMO_ADMIN_ENABLED) {
    if (
      email.trim().toLowerCase() !== DEMO_ADMIN_EMAIL ||
      password !== DEMO_ADMIN_PASSWORD
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

export const getAdminActiveAttendanceSession = () => {
  const session = getSession();
  if (session?.role !== "admin" || !session.token) {
    throw new Error("Sign in with an administrator account to manage attendance.");
  }
  if (isDemoAdmin()) return Promise.resolve(getDemoActiveSession());
  return requestApi("/api/sessions/active/admin", { token: session.token });
};

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

export const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
export const logout = () => localStorage.removeItem(SESSION_KEY);
