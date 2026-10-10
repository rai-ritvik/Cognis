import { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCamera,
  FiClock,
  FiBriefcase,
  FiEdit2,
  FiFlag,
  FiGithub,
  FiInfo,
  FiLink,
  FiRefreshCw,
  FiStopCircle,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import {
  checkInForAttendance,
  getActiveAttendanceSession,
  getMyAnalytics,
  getMyFriends,
  getMyProfile,
  getSession,
  respondToFriendRequest,
  sendFriendRequest,
  updateMyProfile,
} from "../auth";
import { fmtShort } from "./Dashboard";
import "./Dashboard.css";

export function MarkAttendancePage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureCancelledRef = useRef(false);
  const [cameraState, setCameraState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [blinkPrompt, setBlinkPrompt] = useState("");
  const [blinkPromptFrameIndex, setBlinkPromptFrameIndex] = useState(-1);
  const [roomToken, setRoomToken] = useState("");
  const [checkInState, setCheckInState] = useState("idle");
  const [checkInMessage, setCheckInMessage] = useState("");
  const [portalState, setPortalState] = useState("loading");
  const [portalError, setPortalError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [networkIssue, setNetworkIssue] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let isActive = true;
    const checkPortal = async () => {
      try {
        const result = await getActiveAttendanceSession();
        if (!isActive) return;
        setActiveSession(result.session);
        setPortalState(result.active ? "open" : "closed");
        setPortalError("");
        if (!result.active) {
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          setCameraState("idle");
          setCapturedFrames([]);
          setBlinkPrompt("");
          setRoomToken("");
          setCheckInState("idle");
          setCheckInMessage("");
        }
      } catch (error) {
        if (!isActive) return;
        setPortalState("error");
        setPortalError(error.message || "Could not check whether attendance is open.");
      }
    };

    checkPortal();
    const portalTimer = window.setInterval(checkPortal, 15_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      isActive = false;
      window.clearInterval(portalTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  useEffect(() => {
    const connection = navigator.connection;
    const updateNetworkIssue = () => {
      if (!navigator.onLine) {
        setNetworkIssue("Your browser reports that this device is offline. Reconnect to Wi-Fi or mobile data and try again.");
        return;
      }

      if (
        connection &&
        (connection.effectiveType === "slow-2g" ||
          connection.effectiveType === "2g" ||
          connection.rtt >= 2_000)
      ) {
        setNetworkIssue("Your browser reports a very slow network connection. Some online features may take longer or fail.");
        return;
      }

      setNetworkIssue("");
    };

    updateNetworkIssue();
    window.addEventListener("online", updateNetworkIssue);
    window.addEventListener("offline", updateNetworkIssue);
    connection?.addEventListener("change", updateNetworkIssue);
    return () => {
      window.removeEventListener("online", updateNetworkIssue);
      window.removeEventListener("offline", updateNetworkIssue);
      connection?.removeEventListener("change", updateNetworkIssue);
    };
  }, []);

  const issueMessage = cameraError || networkIssue;
  const issueTitle = cameraError
    ? "Camera could not start"
    : networkIssue
      ? navigator.onLine ? "Connection may be slow" : "Device appears offline"
      : "";
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    if (portalState !== "open") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      setCameraError(
        window.isSecureContext
          ? "Camera access is not supported in this browser."
          : "Camera access requires a secure connection. Open this site using HTTPS or localhost.",
      );
      return;
    }
    setCameraError("");
    setCameraState("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraState("ready");
    } catch (error) {
      setCameraState("denied");
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        setCameraError(
          "Camera permission was blocked. Allow camera access for this site in your browser's address-bar or site settings, then try again.",
        );
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraError("No camera was found. Connect a camera and try again.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        setCameraError("The camera is busy or unavailable. Close other apps using it and try again.");
      } else {
        setCameraError(`Could not start the camera${error.message ? `: ${error.message}` : "."}`);
      }
    }
  };

  const stopCamera = () => {
    captureCancelledRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraError("");
    setCameraState("idle");
  };

  const captureFrames = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Wait for the preview and try again.");
      return;
    }

    const frameCount = 24;
    const promptFrame = Math.floor(Math.random() * 6) + 8;
    const frames = [];
    captureCancelledRef.current = false;
    setCameraError("");
    setCheckInState("idle");
    setCheckInMessage("");
    setCaptureProgress(0);
    setBlinkPromptFrameIndex(promptFrame);
    setCameraState("capturing");

    try {
      for (let index = 0; index < frameCount; index += 1) {
        if (captureCancelledRef.current) return;
        if (index === promptFrame) {
          setBlinkPrompt("Blink now");
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          if (captureCancelledRef.current) return;
        }

        const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not capture a frame in this browser.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
        setCaptureProgress(index + 1);
        await new Promise((resolve) => window.setTimeout(resolve, 125));
      }
      setCapturedFrames(frames);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setBlinkPrompt("");
      setCameraState("captured");
    } catch (error) {
      setCameraError(error.message || "Could not capture frames for attendance.");
      setCameraState("ready");
    }
  };

  const submitCheckIn = async (event) => {
    event.preventDefault();
    const user = getSession();
    if (!user?.studentId || !activeSession?.id) {
      setCheckInState("error");
      setCheckInMessage("Your student number or the active session is unavailable. Sign in again and retry.");
      return;
    }
    if (capturedFrames.length < 20) {
      setCheckInState("error");
      setCheckInMessage("Capture the prompted 20-frame liveness scan before submitting attendance.");
      return;
    }

    setCheckInState("processing");
    setCheckInMessage("Checking your location and verifying your photo…");
    try {
      if (!navigator.geolocation) {
        throw new Error("Location access is not supported by this browser.");
      }
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => reject(new Error("Location is unavailable. Allow location access and try again.")),
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );
      });
      const result = await checkInForAttendance({
        roll_number: user.studentId,
        session_id: activeSession.id,
        room_token: roomToken.trim(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        live_frames_base64: capturedFrames,
        blink_prompt_frame_index: blinkPromptFrameIndex,
      });
      if (result.status !== "PRESENT") {
        throw new Error("The server did not confirm a present attendance record.");
      }
      setCheckInState(result.review_status === "PENDING" ? "pending" : "success");
      setCheckInMessage(result.message || "Attendance marked successfully.");
    } catch (error) {
      setCheckInState("error");
      setCheckInMessage(error.message || "Could not verify attendance. Please try again.");
    }
  };

  return (
    <div className="mark-attendance-page">
      <div className="attendance-copy-block">
        <h1>Mark Your Attendance</h1>
        <p>{activeSession ? `Session: ${activeSession.title}. Position your face in the frame and start scanning.` : "Your administrator will open the attendance portal when it is time to check in."}</p>
      </div>

      <div className={`attendance-portal-status is-${portalState}`} role={portalState === "error" ? "alert" : "status"} aria-live="polite">
        <span className="attendance-portal-indicator" aria-hidden="true" />
        <span>
          <strong>{portalState === "loading" ? "Checking attendance availability…" : portalState === "open" ? "Attendance is open" : portalState === "error" ? "Portal status unavailable" : "Attendance is currently closed"}</strong>
          <small>{portalState === "open" ? "You can check in for the active session." : portalState === "error" ? portalError : portalState === "closed" ? "Please wait for your administrator to open a session." : "Connecting to the attendance portal."}</small>
        </span>
      </div>

      <div className="mark-attendance-layout">
        <div className="camera-panel">
          <div className={`camera-preview${cameraState === "ready" || cameraState === "capturing" ? " live" : ""}`}>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" hidden={cameraState !== "ready" && cameraState !== "capturing"} />
            {capturedFrames.length > 0 && cameraState === "captured" ? (
              <img className="camera-captured-photo" src={capturedFrames[capturedFrames.length - 1]} alt="Final frame from attendance liveness scan" />
            ) : cameraState !== "ready" && cameraState !== "capturing" && (
              <div className="camera-placeholder">
                <span className="camera-placeholder-text">{cameraState === "captured" ? "Liveness scan captured. Submit it to verify attendance." : "Selfie camera view"}</span>
              </div>
            )}
          </div>
          {(cameraState === "capturing" || cameraState === "captured") && (
            <p className="attendance-capture-status" role="status" aria-live="polite">
              {cameraState === "capturing"
                ? `${blinkPrompt || "Keep your face in the frame"} — ${captureProgress}/24 frames`
                : `24 frames captured. Followed the blink prompt at frame ${blinkPromptFrameIndex + 1}.`}
            </p>
          )}

          <div className="camera-actions">
            {cameraState === "ready" ? (
              <>
                <button className="action-button" type="button" onClick={captureFrames}>
                  <FiCamera size={16} aria-hidden="true" />
                  Start 24-frame scan
                </button>
                <button className="action-button camera-stop-button" type="button" onClick={stopCamera}>
                  <FiStopCircle size={16} aria-hidden="true" />
                  Stop Camera
                </button>
              </>
            ) : cameraState === "capturing" ? (
              <button className="action-button camera-stop-button" type="button" onClick={stopCamera}>
                <FiStopCircle size={16} aria-hidden="true" />
                Cancel scan
              </button>
            ) : (
              <button className="action-button" type="button" onClick={startCamera} disabled={portalState !== "open" || cameraState === "loading" || cameraState === "unsupported" || capturedFrames.length > 0 || checkInState === "processing" || checkInState === "success"}>
                <FiCamera size={16} aria-hidden="true" />
                {cameraState === "loading" ? "Connecting…" : portalState === "open" ? "Start Camera" : "Attendance portal closed"}
              </button>
            )}
          </div>

          {capturedFrames.length > 0 && (
            <form className="attendance-checkin-form" onSubmit={submitCheckIn}>
              <label htmlFor="attendance-room-token">Room code from your instructor</label>
              <input
                id="attendance-room-token"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                title="Enter the 4-digit room code"
                maxLength={4}
                value={roomToken}
                onChange={(event) => setRoomToken(event.target.value)}
                required
                disabled={checkInState === "processing" || checkInState === "success"}
              />
              <div className="attendance-checkin-actions">
                <button className="action-button" type="submit" disabled={!roomToken.trim() || checkInState === "processing" || checkInState === "success" || checkInState === "pending"}>
                  {checkInState === "processing" ? "Verifying…" : "Verify & Mark Attendance"}
                </button>
                {checkInState !== "success" && checkInState !== "pending" && (
                  <button className="action-button camera-retake-button" type="button" onClick={() => { setCapturedFrames([]); setCaptureProgress(0); setCheckInState("idle"); setCheckInMessage(""); setCameraState("idle"); }} disabled={checkInState === "processing"}>
                    <FiRefreshCw size={16} aria-hidden="true" />
                    Retake
                  </button>
                )}
              </div>
              {checkInMessage && (
                <p className={`attendance-checkin-message is-${checkInState}`} role={checkInState === "error" ? "alert" : "status"} aria-live="polite">
                  {checkInMessage}
                </p>
              )}
            </form>
          )}
          {issueMessage && (
            <div className={`attendance-problem${networkIssue && !cameraError ? " warning" : ""}`} role="alert">
              <h3>{issueTitle}</h3>
              <p>{issueMessage}</p>
            </div>
          )}

          <div className="camera-meta-row">
            <div className="meta-item">
              <div className="meta-icon"><FiCalendar size={16} aria-hidden="true" /></div>
              <div className="meta-copy">
                <span>Date</span>
                <strong>{now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</strong>
              </div>
            </div>
            <div className="meta-divider" aria-hidden="true" />
            <div className="meta-item">
              <div className="meta-icon"><FiClock size={16} aria-hidden="true" /></div>
              <div className="meta-copy">
                <span>Time</span>
                <strong>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</strong>
              </div>
            </div>
            <div className="meta-divider" aria-hidden="true" />
            <div className="meta-item status-item">
              <div className="meta-copy">
                <span>Attendance Status</span>
                <strong className={`status-pill${checkInState === "success" ? " is-present" : checkInState === "pending" ? " is-pending" : ""}`}>
                  {checkInState === "success" ? "Present" : checkInState === "pending" ? "Pending review" : "Not Marked"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <aside className="attendance-tips-pane">
          <div className="info-card tip-card">
            <div className="info-card-header">
              <div className="info-card-icon info-card-icon--soft"><FiInfo size={14} aria-hidden="true" /></div>
              <h3>Scanning Tips</h3>
              <button type="button" className="dismiss-button" aria-label="Close tips">×</button>
            </div>
            <ul>
              <li>Make sure your face is clearly visible.</li>
              <li>Ensure good lighting (avoid dark areas).</li>
              <li>Keep your face steady and look straight.</li>
            </ul>
          </div>

          <div className="info-card warning-card">
            <div className="info-card-header">
              <div className="info-card-icon info-card-icon--warn"><FiAlertTriangle size={14} aria-hidden="true" /></div>
              <h3>Low Light Detected</h3>
              <button type="button" className="dismiss-button" aria-label="Close warning">×</button>
            </div>
            <p>The light is a bit low, please make sure your face is well lit for better recognition.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await getMyFriends();
      setFriends(result.friends || []);
      setRequests(result.requests || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Could not load your friends.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const addFriend = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendFriendRequest(studentId);
      setNotice(result.message);
      setStudentId("");
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Could not send the friend request.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (requestId, status) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await respondToFriendRequest(requestId, status);
      setNotice(result.message);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Could not update the friend request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash-page-view subpage-view">
      <PageHeading eyebrow="YOUR COMMUNITY" title="Friends" copy="Stay connected with your attendance group." />
      <section className="friends-banner">
        <div className="friends-symbol"><FiUser size={24} aria-hidden="true" /></div>
        <div><p className="dash-eyebrow">YOUR GROUP</p><h2>{friends.length} friends</h2><p>Send and manage friend requests with other registered students.</p></div>
      </section>
      {error && <div className="attendance-checkin-message is-error" role="alert">{error}</div>}
      {notice && <div className="attendance-checkin-message is-success" role="status">{notice}</div>}
      <section className="panel profile-editor">
        <h2 className="panel-title">Add a friend</h2>
        <form className="friend-request-form" onSubmit={addFriend}>
          <label htmlFor="friend-student-number">Student number</label>
          <input id="friend-student-number" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Enter 13-digit student number" required />
          <button className="profile-edit-button" type="submit" disabled={busy}>Send request</button>
        </form>
      </section>
      <section className="panel friends-empty">
        <h2>Friend requests</h2>
        {loading ? <p role="status">Loading friend requests…</p> : requests.length === 0 ? <p>No pending requests.</p> : requests.map((request) => (
          <article className="attendance-row" key={request.id}>
            <div className="attendance-event"><strong>{request.member?.full_name || "Student"}</strong><span>{request.member?.roll_number || ""}</span></div>
            {request.incoming ? (
              <div className="friend-request-actions">
                <button className="profile-edit-button" type="button" onClick={() => handleRequest(request.id, "ACCEPTED")} disabled={busy}>Accept</button>
                <button className="profile-github" type="button" onClick={() => handleRequest(request.id, "REJECTED")} disabled={busy}>Decline</button>
              </div>
            ) : <em className="badge">Request sent</em>}
          </article>
        ))}
      </section>
      <section className="panel friends-empty">
        <h2>Your friends</h2>
        {loading ? <p role="status">Loading friends…</p> : friends.length === 0 ? <p>You have not added any friends yet.</p> : friends.map((friend) => (
          <article className="attendance-row" key={friend.id}>
            <div className="attendance-event">
              <strong>{friend.member?.full_name || "Student"}</strong>
              <span>{[friend.member?.roll_number, friend.member?.domain, friend.member?.academic_year].filter(Boolean).join(" · ")}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function ProfilePage() {
  const user = getSession() || {};
  const inputRef = useRef(null);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(() => {
    return {
      year: user.year || "",
      domain: user.domain || "",
      github: user.github || "",
      linkedin: "",
      instagram: "",
      about: "",
      skills: "",
    };
  });
  const [draft, setDraft] = useState(profile);
  const initials = (user.name || "S").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const absentRecords = attendance.filter((record) => record.status === "Absent");
  const lastAbsent = [...absentRecords].sort((a, b) => b.date.localeCompare(a.date))[0];

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      getMyProfile()
        .then((result) => {
          if (!isCurrent) return;
          setProfile(result.profile);
          setDraft(result.profile);
          setPhoto(result.profile.photo || "");
        })
        .catch((loadError) => {
          if (isCurrent) setPhotoError(loadError.message || "Could not load your profile.");
        }),
      getMyAnalytics()
        .then((result) => {
          if (isCurrent) setAttendance(result.attendance || []);
        })
        .catch((loadError) => {
          if (isCurrent) setPhotoError(loadError.message || "Could not load attendance insights.");
        }),
    ]).finally(() => {
      if (isCurrent) setLoading(false);
    });
    return () => { isCurrent = false; };
  }, []);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose an image under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = async () => {
        const scale = Math.min(1, 640 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          setPhotoError("This browser could not process the photo.");
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimizedPhoto = canvas.toDataURL("image/jpeg", 0.82);
        try {
          const result = await updateMyProfile({ profile_photo_base64: optimizedPhoto });
          setPhoto(result.profile.photo || "");
          setProfile(result.profile);
          setDraft(result.profile);
          setPhotoError("");
        } catch (uploadError) {
          setPhotoError(uploadError.message || "The photo could not be saved.");
        }
      };
      image.onerror = () => setPhotoError("This image could not be opened.");
      image.src = reader.result;
    };
    reader.onerror = () => setPhotoError("This image could not be read.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setPhotoError("");
    try {
      const result = await updateMyProfile({
        domain: draft.domain || "",
        academic_year: draft.year || "",
        github_handle: draft.github || "",
        linkedin_url: draft.linkedin || "",
        instagram_url: draft.instagram || "",
        about: draft.about || "",
        skills: draft.skills || "",
      });
      setProfile(result.profile);
      setDraft(result.profile);
      setPhoto(result.profile.photo || "");
      setEditing(false);
    } catch (saveError) {
      setPhotoError(saveError.message || "Profile details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const getSafeUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value}`);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  return (
    <div className="dash-page-view subpage-view">
      <section className="profile-hero">
        <div className="profile-photo-wrap">
          {photo ? <img className="profile-photo" src={photo} alt={`${user.name || "Student"}'s profile`} /> : <span className="profile-photo profile-photo-fallback">{initials}</span>}
          <button className="photo-edit-button" type="button" onClick={() => inputRef.current?.click()} aria-label="Upload profile photo" title="Upload profile photo"><FiCamera size={15} aria-hidden="true" /></button>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={handlePhotoChange} aria-label="Choose a profile photo" />
        </div>
        <div className="profile-identity">
          <h1>{user.name || "Student"}</h1>
          <span className="profile-year">{profile.year || "Study year not set"}</span>
          <p className="profile-student-id">Std no: {user.studentId || "Not provided"}</p>
          <span className="profile-domain"><FiBriefcase size={12} aria-hidden="true" /> {profile.domain || "Add your domain"}</span>
        </div>
        <div className="profile-hero-actions">
          {getSafeUrl(profile.github) ? (
            <a className="profile-github" href={getSafeUrl(profile.github)} target="_blank" rel="noreferrer"><FiGithub size={15} aria-hidden="true" /> GitHub</a>
          ) : (
            <button className="profile-github" type="button" onClick={() => { setDraft(profile); setEditing(true); }}><FiGithub size={15} aria-hidden="true" /> GitHub</button>
          )}
          <button className="profile-edit-button" type="button" onClick={() => { setDraft(profile); setEditing((value) => !value); }}><FiEdit2 size={14} aria-hidden="true" /> {editing ? "Cancel" : "Edit Profile"}</button>
        </div>
      </section>

      {loading && <p className="profile-feedback" role="status">Loading your profile…</p>}
      {photoError && <p className="profile-feedback" role="status">{photoError}</p>}

      {editing && (
        <form className="panel profile-editor" onSubmit={saveProfile}>
          <h2 className="panel-title">Edit profile details</h2>
          <div className="profile-editor-meta">
            <label>Study year<input value={draft.year || ""} onChange={(event) => setDraft({ ...draft, year: event.target.value })} placeholder="2nd Year" /></label>
            <label>Domain<input value={draft.domain || ""} onChange={(event) => setDraft({ ...draft, domain: event.target.value })} placeholder="UI/UX Designing" /></label>
          </div>
          <label>About me<textarea rows="3" value={draft.about || ""} onChange={(event) => setDraft({ ...draft, about: event.target.value })} placeholder="Write a short introduction" /></label>
          <label>Skills, separated by commas<input value={draft.skills || ""} onChange={(event) => setDraft({ ...draft, skills: event.target.value })} placeholder="Design, Python, Data analysis" /></label>
          <div className="profile-editor-links">
            <label>GitHub URL<input value={draft.github || ""} onChange={(event) => setDraft({ ...draft, github: event.target.value })} placeholder="https://github.com/username" /></label>
            <label>LinkedIn URL<input value={draft.linkedin || ""} onChange={(event) => setDraft({ ...draft, linkedin: event.target.value })} placeholder="https://linkedin.com/in/username" /></label>
            <label>Instagram URL<input value={draft.instagram || ""} onChange={(event) => setDraft({ ...draft, instagram: event.target.value })} placeholder="https://instagram.com/username" /></label>
          </div>
          <button className="profile-edit-button" type="submit" data-button-animation disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        </form>
      )}

      <section className="profile-content-grid">
        <article className="panel profile-about">
          <h2 className="panel-title">About me</h2>
          <p>{profile.about || "Add a short introduction about yourself and what you are learning."}</p>
        </article>

        <article className="panel profile-skills-panel">
          <h2 className="panel-title">Skills</h2>
          <div className="profile-skills">
            {(profile.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean).map((skill) => <span className="profile-skill" key={skill}>{skill}</span>)}
            {!profile.skills && <button className="profile-skill profile-skill-add" type="button" onClick={() => { setDraft(profile); setEditing(true); }}>Add skills</button>}
          </div>
        </article>

        <article className="panel profile-flags">
          <div className="flag-illustration" aria-hidden="true"><FiFlag size={42} /><strong>{String(absentRecords.length).padStart(2, "0")}</strong></div>
          <div className="flag-copy"><p className="dash-eyebrow">ATTENDANCE INSIGHT</p><h2>Flag counter</h2><p>{lastAbsent ? `Last absence: ${fmtShort(lastAbsent.date)}` : "No absences recorded"}</p></div>
        </article>

        <article className="panel profile-quick-links">
          <h2 className="panel-title">Quick links</h2>
          <ProfileLink icon={FiGithub} name="GitHub" url={profile.github} getSafeUrl={getSafeUrl} />
          <ProfileLink icon={FiLink} name="LinkedIn" url={profile.linkedin} getSafeUrl={getSafeUrl} />
          <ProfileLink icon={FiLink} name="Instagram" url={profile.instagram} getSafeUrl={getSafeUrl} />
        </article>
      </section>
    </div>
  );
}

function PageHeading({ eyebrow, title, copy }) {
  return <header className="subpage-heading"><p className="dash-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></header>;
}

function ProfileLink({ icon: Icon, name, url, getSafeUrl }) {
  const safeUrl = getSafeUrl(url);
  return safeUrl ? (
    <a className="profile-link-row" href={safeUrl} target="_blank" rel="noreferrer"><Icon size={16} aria-hidden="true" /><span>{name}</span><strong>{safeUrl.replace(/^https?:\/\//, "")}</strong></a>
  ) : (
    <div className="profile-link-row empty-link"><Icon size={16} aria-hidden="true" /><span>{name}</span><strong>Add a link in Edit profile</strong></div>
  );
}