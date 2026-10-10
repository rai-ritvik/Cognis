import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiCamera, FiLock, FiMail, FiUser } from "react-icons/fi";
import { afterButtonAnimation } from "../ButtonAnimation";
import { registerUser } from "../auth";

export default function Register() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    email: "",
    password: "",
    confirm: "",
    domain: "",
    academicYear: "",
    consent: false,
  });
  const [error, setError] = useState("");
  const [frames, setFrames] = useState([]);
  const [cameraState, setCameraState] = useState("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const onChange = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires a supported browser and a secure connection (HTTPS or localhost).");
      return;
    }
    setError("");
    setCameraState("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraState("ready");
    } catch (cameraError) {
      setCameraState("idle");
      setError(cameraError.message || "Could not start the camera. Allow camera access and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("Wait until the camera preview is ready before capturing.");
      return;
    }
    if (frames.length >= 8) return;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture an image in this browser.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFrames((current) => [...current, canvas.toDataURL("image/jpeg", 0.8)]);
    setError("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!/^\d{13}$/.test(form.studentId.trim()))
      return setError("Student number must contain exactly 13 digits.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    if (!form.consent)
      return setError("Consent to biometric processing is required to register.");
    if (frames.length < 3)
      return setError("Capture at least 3 face frames before registering.");
    setIsSubmitting(true);
    try {
      stopCamera();
      await registerUser({
        roll_number: form.studentId.trim(),
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        domain: form.domain.trim(),
        academic_year: form.academicYear,
        consent: form.consent,
        baseline_frames_base64: frames,
      });
      afterButtonAnimation(() => navigate("/dashboard"));
    } catch (registrationError) {
      setError(registrationError.message || "Registration failed. Please try again.");
      setIsSubmitting(false);
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
          inputMode="numeric"
          pattern="[0-9]{13}"
          maxLength={13}
          title="Student number must contain exactly 13 digits"
          placeholder="Enter your 13-digit student number"
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

      <div className={`login-field${form.domain ? " has-value" : ""}`}>
        <label htmlFor="domain"><FiUser aria-hidden="true" /><span>Domain</span></label>
        <input
          id="domain"
          name="domain"
          placeholder="e.g., Artificial Intelligence"
          required
          value={form.domain}
          onChange={onChange}
        />
      </div>

      <div className={`login-field${form.academicYear ? " has-value" : ""}`}>
        <label htmlFor="academicYear"><FiUser aria-hidden="true" /><span>Study year</span></label>
        <select id="academicYear" name="academicYear" required value={form.academicYear} onChange={onChange}>
          <option value="" disabled>Select your year</option>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
        </select>
      </div>

      <section className="register-face-capture" aria-labelledby="register-face-heading">
        <h3 id="register-face-heading">Face enrollment</h3>
        <p>Capture 3 to 8 clear frames. Your images are sent securely to the identity service for enrollment.</p>
        <video ref={videoRef} autoPlay muted playsInline hidden={cameraState !== "ready"} aria-label="Face enrollment camera preview" />
        {cameraState !== "ready" ? (
          <button className="register-camera-button" type="button" onClick={startCamera} disabled={cameraState === "loading" || frames.length >= 8}>
            <FiCamera aria-hidden="true" />{cameraState === "loading" ? "Starting camera…" : "Start camera"}
          </button>
        ) : (
          <div className="register-camera-actions">
            <button className="register-camera-button" type="button" onClick={captureFrame} disabled={frames.length >= 8}>
              <FiCamera aria-hidden="true" />Capture frame ({frames.length}/8)
            </button>
            <button className="register-camera-button secondary" type="button" onClick={stopCamera}>Stop camera</button>
          </div>
        )}
        <div className="register-frame-status" role="status" aria-live="polite">
          {frames.length < 3
            ? `${frames.length} captured — ${3 - frames.length} more required`
            : `${frames.length} frames captured — minimum reached`}
          {frames.length > 0 && (
            <button type="button" onClick={() => setFrames([])} disabled={isSubmitting}>Retake all</button>
          )}
        </div>
      </section>

      <label className="register-biometric-consent">
        <input type="checkbox" name="consent" checked={form.consent} onChange={onChange} required />
        <span>I consent to processing my face images and biometric data for identity verification and attendance.</span>
      </label>

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

      <button type="submit" className="sign-in-button" data-button-animation disabled={isSubmitting || frames.length < 3 || !form.consent}>
        {isSubmitting ? "Registering…" : "Register"}
      </button>

      <p className="switch">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
