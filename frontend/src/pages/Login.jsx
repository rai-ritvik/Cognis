import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { afterButtonAnimation } from "../ButtonAnimation";
import { loginUser, loginWithGoogle } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [form, setForm] = useState({ studentId: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("");
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) {
      setGoogleStatus("Google sign-in needs a VITE_GOOGLE_CLIENT_ID configuration.");
      return undefined;
    }

    let isActive = true;
    const renderGoogleButton = () => {
      if (!isActive || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError("Google did not return a sign-in credential. Please try again.");
            return;
          }
          setError("");
          try {
            await loginWithGoogle(credential);
            afterButtonAnimation(() => navigate("/dashboard"));
          } catch (err) {
            setError(err.message);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(400, Math.floor(googleButtonRef.current.clientWidth)),
      });
      setGoogleStatus("");
    };
    const handleLoadError = () => {
      if (isActive) setGoogleStatus("Unable to load Google sign-in. Check your connection and retry.");
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.getElementById("google-identity-services");
      if (!script) {
        script = document.createElement("script");
        script.id = "google-identity-services";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
      }
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleLoadError);
      if (!script.isConnected) document.head.appendChild(script);
    }

    return () => {
      isActive = false;
      const script = document.getElementById("google-identity-services");
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", handleLoadError);
    };
  }, [googleClientId, navigate]);

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

      <button type="submit" className="sign-in-button login-submit" data-button-animation>
        <span>Login</span>
        <FiArrowRight aria-hidden="true" />
      </button>

      {googleClientId ? (
        <div className="login-google-button-slot" ref={googleButtonRef} />
      ) : (
        <button className="login-google-button--disabled" type="button" disabled>
          <FcGoogle aria-hidden="true" />
          <span>Continue with Google</span>
        </button>
      )}
      <small className="login-google-status" id="google-login-status" role="status" aria-live="polite">
        {googleStatus}
      </small>

      <p className="admin-login-link">
        Site administrator? <Link to="/admin/login">Admin sign in</Link>
      </p>
    </form>
  );
}
