import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowRight, FiLock, FiMail } from "react-icons/fi";
import { afterButtonAnimation } from "../ButtonAnimation";
import { loginAdmin } from "../auth";

const DEMO_CREDENTIALS = import.meta.env.DEV
  ? { email: "admin@netra.test", password: "netra-demo" }
  : null;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await loginAdmin(form);
      afterButtonAnimation(() => navigate("/admin"));
    } catch (loginError) {
      setError(loginError.message || "Admin sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form login-form admin-login-form" onSubmit={onSubmit}>
      <div className="login-register-prompt">
        <span>Student?</span>
        <Link to="/login">Student login</Link>
      </div>

      <h2>Admin sign in</h2>
      <p className="login-copy">Sign in to manage the attendance portal.</p>

      {error && <div className="error" role="alert">{error}</div>}

      <div className={`login-field${form.email ? " has-value" : ""}`}>
        <label htmlFor="admin-email"><FiMail aria-hidden="true" /><span>Admin email</span></label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="Enter your admin email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </div>

      <div className={`login-field${form.password ? " has-value" : ""}`}>
        <label htmlFor="admin-password"><FiLock aria-hidden="true" /><span>Password</span></label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your admin password"
          required
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
      </div>

      <button type="submit" className="sign-in-button login-submit" disabled={isSubmitting} data-button-animation>
        <span>{isSubmitting ? "Signing in…" : "Sign in as admin"}</span>
        <FiArrowRight aria-hidden="true" />
      </button>
      {DEMO_CREDENTIALS ? (
        <p className="admin-login-note">
          Development demo: <strong>{DEMO_CREDENTIALS.email}</strong> / <strong>{DEMO_CREDENTIALS.password}</strong>
          <br />Demo access is available only while running the development server.
        </p>
      ) : (
        <p className="admin-login-note">Admin accounts are provisioned by the site owner.</p>
      )}
    </form>
  );
}
