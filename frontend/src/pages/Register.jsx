import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiLock, FiMail, FiUser } from "react-icons/fi";
import { afterButtonAnimation } from "../ButtonAnimation";
import { registerUser } from "../auth";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    try {
      registerUser(form);
      afterButtonAnimation(() => navigate("/dashboard"));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="auth-form register-form" onSubmit={onSubmit}>
      <h2>Create your account</h2>
      <p className="login-copy">It takes less than a minute.</p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className={`login-field${form.name ? " has-value" : ""}`}>
        <label htmlFor="name"><FiUser aria-hidden="true" /><span>Full name</span></label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Enter your full name"
          required
          value={form.name}
          onChange={onChange}
        />
      </div>

      <div className={`login-field${form.studentId ? " has-value" : ""}`}>
        <label htmlFor="studentId"><FiUser aria-hidden="true" /><span>Student number / ID</span></label>
        <input
          id="studentId"
          name="studentId"
          autoComplete="username"
          placeholder="Enter your student number"
          required
          value={form.studentId}
          onChange={onChange}
        />
      </div>

      <div className={`login-field${form.email ? " has-value" : ""}`}>
        <label htmlFor="email"><FiMail aria-hidden="true" /><span>Email</span></label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          required
          value={form.email}
          onChange={onChange}
        />
      </div>

      <div className={`login-field${form.password ? " has-value" : ""}`}>
        <label htmlFor="password"><FiLock aria-hidden="true" /><span>Password</span></label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          required
          value={form.password}
          onChange={onChange}
        />
      </div>

      <div className={`login-field${form.confirm ? " has-value" : ""}`}>
        <label htmlFor="confirm"><FiLock aria-hidden="true" /><span>Confirm password</span></label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm your password"
          required
          value={form.confirm}
          onChange={onChange}
        />
      </div>

      <button type="submit" className="sign-in-button" data-button-animation>
        Register
      </button>

      <p className="switch">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
