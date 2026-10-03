import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      navigate("/dashboard"); // straight to dashboard after successful registration
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h2>Create your account</h2>
      <p className="login-copy">It takes less than a minute.</p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="input-group">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={onChange}
        />
      </div>

      <div className="input-group">
        <label htmlFor="studentId">Student number / ID</label>
        <input
          id="studentId"
          name="studentId"
          autoComplete="username"
          required
          value={form.studentId}
          onChange={onChange}
        />
      </div>

      <div className="input-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={onChange}
        />
      </div>

      <div className="input-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={onChange}
        />
      </div>

      <div className="input-group">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={onChange}
        />
      </div>

      <button type="submit" className="sign-in-button">
        Register
      </button>

      <p className="switch">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
