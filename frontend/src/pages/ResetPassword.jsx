import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { completePasswordReset } from "../auth";

export default function ResetPassword() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const token = parameters.get("access_token");
    const recoveryType = parameters.get("type");
    const providerError = parameters.get("error_description");
    if (providerError) {
      setError(providerError);
    } else if (token && recoveryType === "recovery") {
      setAccessToken(token);
    } else {
      setError("This password reset link is invalid or has expired. Request a new link.");
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const result = await completePasswordReset(accessToken, password);
      setNotice(result.message);
      setAccessToken("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (resetError) {
      setError(resetError.message || "Could not update your password. Request a new reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form login-form" onSubmit={submit}>
      <p className="login-register-prompt"><span>Back to sign in</span><Link to="/login">Login</Link></p>
      <h2>Choose a new password</h2>
      <p className="login-copy">Use at least 8 characters for your new account password.</p>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="auth-success" role="status">{notice}</div>}
      {accessToken && !notice && (
        <>
          <div className={`login-field${password ? " has-value" : ""}`}>
            <label htmlFor="new-password"><span>New password</span></label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className={`login-field${confirmPassword ? " has-value" : ""}`}>
            <label htmlFor="confirm-password"><span>Confirm new password</span></label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <button type="submit" className="sign-in-button login-submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </>
      )}
      {!accessToken && !notice && <p className="admin-login-link"><Link to="/forgot-password">Request another reset link</Link></p>}
    </form>
  );
}
