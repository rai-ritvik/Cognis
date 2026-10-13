import {useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {FiArrowRight, FiHash, FiLock} from "react-icons/fi";
import {afterButtonAnimation} from "../ButtonAnimation";
import {loginAdmin} from "../auth";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({rollNumber: "", password: ""});
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
      <p className="login-copy">
        Sign in using your administrator student number and password.
      </p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className={`login-field${form.rollNumber ? " has-value" : ""}`}>
        <label htmlFor="admin-roll-number">
          <FiHash aria-hidden="true" />
          <span>Student Number</span>
        </label>
        <input
          id="admin-roll-number"
          name="rollNumber"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          placeholder="Enter your student number"
          required
          value={form.rollNumber}
          onChange={(event) =>
            setForm({...form, rollNumber: event.target.value})
          }
        />
      </div>

      <div className={`login-field${form.password ? " has-value" : ""}`}>
        <label htmlFor="admin-password">
          <FiLock aria-hidden="true" />
          <span>Password</span>
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          value={form.password}
          onChange={(event) => setForm({...form, password: event.target.value})}
        />
      </div>

      <button
        type="submit"
        className="sign-in-button login-submit"
        disabled={isSubmitting}
        data-button-animation
      >
        <span>{isSubmitting ? "Signing in…" : "Sign in as admin"}</span>
        <FiArrowRight aria-hidden="true" />
      </button>

      <p className="admin-login-note">
        Use an administrator account provisioned by the site owner.
      </p>
    </form>
  );
}
