// Temporary localStorage auth. Replace the bodies with your real API calls later.
const USERS_KEY = "sa_users";
const SESSION_KEY = "sa_session";

const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || "[]");

export function registerUser({ name, studentId, email, password }) {
  const users = getUsers();
  const normalizedStudentId = studentId.trim().toLowerCase();
  if (!normalizedStudentId) {
    throw new Error("Enter your student number.");
  }
  if (users.some((u) => u.studentId?.toLowerCase() === normalizedStudentId)) {
    throw new Error("This student number is already registered. Please log in.");
  }

  const normalizedEmail = email.toLowerCase();
  const existingUser = users.find((u) => u.email === normalizedEmail);
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
      JSON.stringify({ name: upgradedUser.name, studentId: upgradedUser.studentId, email: upgradedUser.email })
    );
    return upgradedUser;
  }
  if (existingUser) {
    throw new Error("This email is already registered. Please log in.");
  }

  const user = { name, studentId: normalizedStudentId, email: normalizedEmail, password };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name, studentId: user.studentId, email: user.email })); // auto login
  return user;
}

export function loginUser({ studentId, password }) {
  const normalizedStudentId = studentId.trim().toLowerCase();
  const user = getUsers().find(
    (u) => u.studentId?.toLowerCase() === normalizedStudentId && u.password === password
  );
  if (!user) throw new Error("Incorrect student number or password.");
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, studentId: user.studentId, email: user.email }));
  return user;
}

export const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
export const logout = () => localStorage.removeItem(SESSION_KEY);
