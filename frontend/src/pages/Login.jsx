import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { afterButtonAnimation } from "../ButtonAnimation";
import { loginUser } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ studentId: "", password: "" });
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    try {
      loginUser(form);
      afterButtonAnimation(() => navigate("/dashboard"));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h2>Log in</h2>
      <p className="login-copy">
        Enter your details to mark and view attendance.
      </p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="input-group">
        <label htmlFor="studentId"> <h3>Student ID / Email</h3></label>
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
        <label htmlFor="password"> <h3>Password</h3></label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={onChange}
        />
      </div>

      <button type="submit" className="sign-in-button" data-button-animation>
        <h1> Log in</h1>
      </button>

      <p className="switch">
        Not registered yet? <Link to="/register">Register here</Link>
      </p>
    </form>
  );
}
