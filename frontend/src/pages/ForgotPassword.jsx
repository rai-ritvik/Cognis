import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../auth";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestPasswordReset(identifier.trim());
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message || "Could not request a password reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form login-form" onSubmit={submit}>
      <p className="login-register-prompt"><span>Remembered your password?</span><Link to="/login">Login</Link></p>
      <h2>Reset password</h2>
      <p className="login-copy">Enter your student number or account email. If it matches a student account, we’ll email a secure reset link.</p>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="auth-success" role="status">{notice}</div>}
      <div className={`login-field${identifier ? " has-value" : ""}`}>
        <label htmlFor="reset-identifier"><span>Student number or email</span></label>
        <input
          id="reset-identifier"
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
      </div>
      <button type="submit" className="sign-in-button login-submit" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
