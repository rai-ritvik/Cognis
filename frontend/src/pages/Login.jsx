import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser } from "react-icons/fi";
import { afterButtonAnimation } from "../ButtonAnimation";
import { loginUser, loginWithGoogle } from "../auth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

export default function Login() {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [form, setForm] = useState({ studentId: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginUser(form);
      afterButtonAnimation(() => navigate("/dashboard"));
    } catch (err) {
      setError(err.message || "Student sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let isCurrent = true;
    const initializeGoogleSignIn = () => {
      if (!isCurrent) return;
      const identity = window.google?.accounts?.id;
      if (!identity || !googleButtonRef.current) {
        setError("Google sign-in could not be initialized. Please use your student number and password.");
        return;
      }
      identity.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError("");
          setBusy(true);
          try {
            await loginWithGoogle(credential);
            afterButtonAnimation(() => navigate("/dashboard"));
          } catch (loginError) {
            setError(loginError.message || "Google sign-in failed. Please try again.");
          } finally {
            setBusy(false);
          }
        },
      });
      identity.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(360, googleButtonRef.current.clientWidth),
      });
    };

    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
      return () => { isCurrent = false; };
    }

    let script = document.querySelector('script[data-google-identity]');
    const onLoad = () => initializeGoogleSignIn();
    const onError = () => {
      if (isCurrent) setError("Google sign-in could not be loaded. Please use your student number and password.");
    };
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
    }
    return () => {
      isCurrent = false;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [navigate]);

  return (
    <form className="auth-form login-form" onSubmit={onSubmit}>
      <div className="login-register-prompt">
        <span>New Student?</span>
        <Link to="/register">Register here</Link>
      </div>

      <h2>Welcome Back!</h2>
      <p className="login-copy">Login to continue</p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className={`login-field${form.studentId ? " has-value" : ""}`}>
        <label htmlFor="studentId">
          <FiUser aria-hidden="true" />
          <span>Student Number</span>
        </label>
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

      <div className={`login-field${form.password ? " has-value" : ""}`}>
        <label htmlFor="password">
          <FiLock aria-hidden="true" />
          <span>Password</span>
        </label>
        <div className="login-password-control">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            value={form.password}
            onChange={onChange}
          />
          <button
            className="login-password-toggle"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="login-password-links"><Link to="/forgot-password">Forgot password?</Link></div>

      <button type="submit" className="sign-in-button login-submit" data-button-animation disabled={busy}>
        <span>{busy ? "Signing in…" : "Login"}</span>
        <FiArrowRight aria-hidden="true" />
      </button>

      {GOOGLE_CLIENT_ID && (
        <>
          <div className="auth-divider"><span>or</span></div>
          <div className="google-sign-in" ref={googleButtonRef} aria-label="Continue with Google" />
        </>
      )}

      <p className="admin-login-link">
        Site administrator? <Link to="/admin/login">Admin sign in</Link>
      </p>
    </form>
  );
}
