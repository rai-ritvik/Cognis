import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset, verifyPasswordResetCode } from "../auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [rollNumber, setRollNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("request");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (step === "request") {
        const result = await requestPasswordReset(rollNumber.trim());
        setStep("verify");
        setNotice(result.message || "If the account exists, a code has been sent to its registered email.");
      } else {
        const result = await verifyPasswordResetCode(rollNumber.trim(), code.trim());
        if (!result.reset_token) throw new Error("The server did not return a reset token. Request a new code.");
        navigate(`/reset-password?reset_token=${encodeURIComponent(result.reset_token)}`);
      }
    } catch (requestError) {
      setError(requestError.message || "Could not process the password reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form login-form" onSubmit={submit}>
      <p className="login-register-prompt"><span>Remembered your password?</span><Link to="/login">Login</Link></p>
      <h2>{step === "request" ? "Reset password" : "Verify reset code"}</h2>
      <p className="login-copy">
        {step === "request"
          ? "Enter your student number. If it matches an account, a six-digit code will be sent to its registered email."
          : "Enter the six-digit code sent to your registered email. The code expires after two minutes."}
      </p>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="auth-success" role="status">{notice}</div>}
      <div className={`login-field${rollNumber ? " has-value" : ""}`}>
        <label htmlFor="reset-roll-number"><span>Student number</span></label>
        <input
          id="reset-roll-number"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          required
          disabled={step === "verify"}
          value={rollNumber}
          onChange={(event) => setRollNumber(event.target.value)}
        />
      </div>
      {step === "verify" && (
        <div className={`login-field${code ? " has-value" : ""}`}>
          <label htmlFor="reset-code"><span>Six-digit code</span></label>
          <input
            id="reset-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\\D/g, "").slice(0, 6))}
          />
        </div>
      )}
      <button type="submit" className="sign-in-button login-submit" disabled={busy}>
        {busy ? "Please wait…" : step === "request" ? "Send verification code" : "Verify code"}
      </button>
      {step === "verify" && <button type="button" className="admin-login-link" onClick={() => { setStep("request"); setCode(""); setNotice(""); setError(""); }}>Use a different student number</button>}
    </form>
  );
}
