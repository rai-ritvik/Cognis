import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiInfo,
  FiLogOut,
  FiMapPin,
  FiPower,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import {
  endAttendanceSession,
  getAdminActiveAttendanceSession,
  getSession,
  getSessionAttendance,
  logout,
  rotateAttendanceRoomToken,
  startAttendanceSession,
} from "../auth";
import "./AdminDashboard.css";

const getCoordinates = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser. Enter the class coordinates instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow it in your browser or enter the class coordinates."
          : "Could not get your location. Try again or enter the class coordinates.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getSession();
  const isDemo = user?.demo === true;
  const [title, setTitle] = useState("");
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "" });
  const [activeSession, setActiveSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [roomToken, setRoomToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const result = await getAdminActiveAttendanceSession();
      setActiveSession(result.session);
      setRoomToken(result.session?.current_room_token || "");
      if (result.session) {
        const attendance = await getSessionAttendance(result.session.id);
        setAttendees(attendance.students || []);
      } else {
        setAttendees([]);
      }
      setError("");
    } catch (refreshError) {
      setError(refreshError.message || "Could not load attendance session details.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const refreshTimer = window.setInterval(refresh, 15_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleLocate = async () => {
    setLocationBusy(true);
    setError("");
    try {
      const location = await getCoordinates();
      setCoordinates({
        latitude: location.latitude.toFixed(6),
        longitude: location.longitude.toFixed(6),
      });
      setNotice("Class location added.");
    } catch (locationError) {
      setError(locationError.message);
    } finally {
      setLocationBusy(false);
    }
  };

  const handleStart = async (event) => {
    event.preventDefault();
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await startAttendanceSession({
        title,
        latitude: Number(coordinates.latitude),
        longitude: Number(coordinates.longitude),
      });
      setRoomToken(result.current_room_token || "");
      setTitle("");
      setNotice("Attendance is open. Students can now check in through the portal.");
      await refresh();
    } catch (startError) {
      setError(startError.message || "Could not open the attendance portal.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!activeSession || !window.confirm("Close attendance for this session? Students will no longer be able to check in.")) return;
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      await endAttendanceSession(activeSession.id);
      setActiveSession(null);
      setAttendees([]);
      setRoomToken("");
      setNotice("Attendance is closed. Students can no longer check in.");
      await refresh();
    } catch (endError) {
      setError(endError.message || "Could not close the attendance session.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRotateToken = async () => {
    if (!activeSession) return;
    setIsBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await rotateAttendanceRoomToken(activeSession.id);
      setRoomToken(result.new_room_token);
      setNotice("Room code updated. Share the new code with your students.");
    } catch (rotateError) {
      setError(rotateError.message || "Could not update the room code.");
    } finally {
      setIsBusy(false);
    }
  };

  const formattedDate = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-logo" href="/admin" aria-label="Netra admin home">
          <img src="/netra-logo.svg.png" alt="Netra" />
        </a>
        <div className="admin-side-label">ADMINISTRATION</div>
        <div className="admin-nav-item active"><FiShield aria-hidden="true" /><span>Portal control</span></div>
        <div className="admin-sidebar-note">
          <span className={`admin-sidebar-status${activeSession ? " is-open" : ""}`} />
          <span>{activeSession ? "Attendance is open" : "Portal is closed"}</span>
        </div>
        <button className="admin-logout" type="button" onClick={handleLogout}>
          <FiLogOut aria-hidden="true" /><span>Log out</span>
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-top-date">
            <FiCalendar aria-hidden="true" />
            <span>{formattedDate}<small>{formattedTime}</small></span>
          </div>
          <div className="admin-user">
            <span className="admin-avatar">{(user?.name || "A").slice(0, 1).toUpperCase()}</span>
            <span>{user?.name || "Administrator"}<small>Administrator</small></span>
          </div>
        </header>

        <section className="admin-welcome">
          <div>
            <p className="admin-eyebrow">ATTENDANCE MANAGEMENT</p>
            <h1>Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"},</h1>
            <h2>{user?.name || "Administrator"}</h2>
            <p>Open or close the student attendance portal whenever your session is ready.</p>
          </div>
          <div className="admin-welcome-icon"><FiShield aria-hidden="true" /></div>
        </section>

        {isDemo && (
          <div className="admin-feedback is-demo" role="status">
            <FiInfo aria-hidden="true" />
            Demo mode: session controls and sample attendance are stored in this browser only.
          </div>
        )}

        {error && <div className="admin-feedback is-error" role="alert"><FiAlertCircle aria-hidden="true" />{error}</div>}
        {notice && <div className="admin-feedback is-success" role="status"><FiCheckCircle aria-hidden="true" />{notice}</div>}

        <section className="admin-stats" aria-label="Current session summary">
          <article className="admin-stat">
            <span className="admin-stat-icon"><FiPower aria-hidden="true" /></span>
            <span className="admin-stat-label">Portal status</span>
            <strong className={activeSession ? "status-open" : ""}>{isLoading ? "Checking…" : activeSession ? "Open" : "Closed"}</strong>
            <small>{activeSession ? "Students can check in" : "Not accepting check-ins"}</small>
          </article>
          <article className="admin-stat">
            <span className="admin-stat-icon"><FiUsers aria-hidden="true" /></span>
            <span className="admin-stat-label">Present in session</span>
            <strong>{activeSession ? attendees.length : "—"}</strong>
            <small>{activeSession ? "Recorded check-ins" : "Start a session to begin"}</small>
          </article>
          <article className="admin-stat">
            <span className="admin-stat-icon"><FiClock aria-hidden="true" /></span>
            <span className="admin-stat-label">Current session</span>
            <strong className="admin-stat-title">{activeSession?.title || "No active session"}</strong>
            <small>{activeSession?.created_at ? new Date(activeSession.created_at).toLocaleString() : "Open a session when ready"}</small>
          </article>
        </section>

        <div className="admin-content-grid">
          <section className="admin-panel admin-control-panel">
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">{activeSession ? "LIVE SESSION" : "READY WHEN YOU ARE"}</p>
                <h2>{activeSession ? "Attendance portal is open" : "Open attendance portal"}</h2>
                <p>{activeSession
                  ? "Students can now open the attendance page and check in."
                  : "Start a session to let students access attendance check-in."}</p>
              </div>
              <span className={`admin-live-indicator${activeSession ? " is-live" : ""}`}><i />{activeSession ? "LIVE" : "CLOSED"}</span>
            </div>

            {activeSession ? (
              <div className="admin-active-session">
                <div className="admin-session-detail">
                  <span>Session</span><strong>{activeSession.title}</strong>
                </div>
                <div className="admin-session-detail">
                  <span>Started</span><strong>{activeSession.created_at ? new Date(activeSession.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</strong>
                </div>
                <div className="admin-room-code">
                  <div><span>Room check-in code</span><small>Share this code with students in the classroom.</small></div>
                  <strong aria-live="polite">{roomToken || "••••"}</strong>
                </div>
                <div className="admin-control-actions">
                  <button className="admin-secondary-button" type="button" onClick={handleRotateToken} disabled={isBusy}>
                    <FiRefreshCw aria-hidden="true" /> Update room code
                  </button>
                  <button className="admin-danger-button" type="button" onClick={handleEnd} disabled={isBusy}>
                    <FiPower aria-hidden="true" /> {isBusy ? "Please wait…" : "Close attendance"}
                  </button>
                </div>
              </div>
            ) : (
              <form className="admin-start-form" onSubmit={handleStart}>
                <label htmlFor="session-title">Session title</label>
                <input
                  id="session-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Task Evaluation"
                  maxLength={100}
                  required
                />
                {isDemo ? (
                  <p className="admin-location-help">Demo mode uses sample location data; no GPS or database is needed.</p>
                ) : (
                  <>
                    <div className="admin-location-heading">
                      <div><label>Class location</label><small>Check-ins are verified against this location.</small></div>
                      <button className="admin-location-button" type="button" onClick={handleLocate} disabled={locationBusy}>
                        <FiMapPin aria-hidden="true" />{locationBusy ? "Getting location…" : "Use my location"}
                      </button>
                    </div>
                    <div className="admin-coordinate-fields">
                      <label>Latitude
                        <input type="number" min="-90" max="90" step="any" value={coordinates.latitude} onChange={(event) => setCoordinates({ ...coordinates, latitude: event.target.value })} required />
                      </label>
                      <label>Longitude
                        <input type="number" min="-180" max="180" step="any" value={coordinates.longitude} onChange={(event) => setCoordinates({ ...coordinates, longitude: event.target.value })} required />
                      </label>
                    </div>
                    <p className="admin-location-help">You can enter the classroom coordinates manually if you are not there now.</p>
                  </>
                )}
                <button className="admin-start-button" type="submit" disabled={isBusy || isLoading}>
                  <FiPower aria-hidden="true" />{isBusy ? "Opening portal…" : "Open attendance portal"}
                </button>
              </form>
            )}
          </section>

          <section className="admin-panel admin-attendees-panel">
            <div className="admin-panel-heading admin-attendees-heading">
              <div><p className="admin-eyebrow">CHECK-IN ACTIVITY</p><h2>Students present</h2></div>
              <span className="admin-attendee-count">{attendees.length}</span>
            </div>
            {!activeSession ? (
              <div className="admin-empty-state"><FiUsers aria-hidden="true" /><p>Open an attendance session to see student check-ins here.</p></div>
            ) : attendees.length === 0 ? (
              <div className="admin-empty-state"><FiUsers aria-hidden="true" /><p>No students have checked in yet.</p></div>
            ) : (
              <div className="admin-attendee-list" aria-live="polite">
                {attendees.map((attendee, index) => (
                  <div className="admin-attendee-row" key={`${attendee.roll_number}-${attendee.time_logged || index}`}>
                    <span className="admin-attendee-avatar">{(attendee.roll_number || "?").slice(0, 1).toUpperCase()}</span>
                    <span className="admin-attendee-id">{attendee.roll_number || "Student"}</span>
                    <span className="admin-present-badge"><FiCheckCircle aria-hidden="true" /> Present</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
