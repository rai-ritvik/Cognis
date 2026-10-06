import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiCalendar,
  FiCamera,
  FiHome,
  FiLogOut,
  FiMaximize,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { getSession, logout } from "../auth";
import "./Dashboard.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: FiHome },
  { to: "/mark-attendance", label: "Mark attendance", icon: FiMaximize },
  { to: "/analytics", label: "Analytics", icon: FiBarChart2 },
  { to: "/friends", label: "Friends", icon: FiUsers },
  { to: "/profile", label: "Profile", icon: FiUser },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getSession();
  const userName = user?.name || "Student";
  const isMarkAttendanceRoute = location.pathname === "/mark-attendance";
  const [now, setNow] = useState(new Date());
  const [cameraOnline, setCameraOnline] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) =>
        setCameraOnline(devices.some((device) => device.kind === "videoinput")),
      )
      .catch(() => setCameraOnline(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={`dash${isMarkAttendanceRoute ? " mark-attendance-route" : ""}`}>
      <aside className="dash-sidebar">
        <NavLink className="dash-logo" to="/dashboard" aria-label="Netra home">
          <img className="dash-logo-image" src="/netra-logo.svg.png" alt="Netra" />
        </NavLink>

        <nav className="dash-nav" aria-label="Dashboard navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                "dash-nav-item" + (isActive ? " active" : "")
              }
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="dash-logout" type="button" onClick={handleLogout}>
          <FiLogOut size={16} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </aside>

      <main className="dash-main">
        {!isMarkAttendanceRoute && (
          <header className="dash-topbar">
            <div className="dash-top-date">
              <FiCalendar size={17} aria-hidden="true" />
              <div className="dash-top-text">
                <span>{now.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}</span>
                <span>{now.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
              </div>
            </div>

            <div className="dash-top-right">
              <div className="camera-status">
                <span className={`dash-cam-icon${cameraOnline ? "" : " off"}`}>
                  <FiCamera size={13} aria-hidden="true" />
                </span>
                <span className={cameraOnline ? "cam-online" : "cam-offline"}>
                  {cameraOnline ? "Camera ready" : "Camera unavailable"}
                </span>
              </div>
              <button
                className="dash-user"
                type="button"
                onClick={() => navigate("/profile")}
                aria-label={`Open profile for ${userName}`}
              >
                <span className="user-avatar" aria-hidden="true">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="dash-user-name">{userName}</span>
              </button>
            </div>
          </header>
        )}

        <div className="dash-route page-content" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}