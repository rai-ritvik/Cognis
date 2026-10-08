import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./pages/DashboardLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import {
  FriendsPage,
  MarkAttendancePage,
  ProfilePage,
} from "./pages/AttendancePages";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { getSession } from "./auth";
import ButtonAnimation from "./ButtonAnimation";
import "./index.css";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

const Protected = ({ children, role }) => {
  const session = getSession();
  if (!session) return <Navigate to={role === "admin" ? "/admin/login" : "/login"} replace />;
  const sessionRole = session.role || "student";
  if (role && sessionRole !== role) {
    return <Navigate to={sessionRole === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
};

const TRANSITION_VARIANTS = {
  "/dashboard": "home",
  "/mark-attendance": "attendance",
  "/analytics": "analytics",
  "/friends": "friends",
  "/profile": "profile",
  "/login": "login",
  "/register": "register",
  "/admin/login": "login",
  "/admin": "home",
};

const TRANSITION_MS = 520;

function PageTransition() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const [transitionPath, setTransitionPath] = useState(null);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setTransitionPath(pathname);
    const timeout = window.setTimeout(() => setTransitionPath(null), TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  if (!transitionPath || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }

  const variant = TRANSITION_VARIANTS[transitionPath] || "home";
  return (
    <div
      key={transitionPath}
      className={`route-transition route-transition--${variant}`}
      aria-hidden="true"
    />
  );
}

function AttendanceStartHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const openAttendancePage = () => navigate("/mark-attendance");
    window.addEventListener("netra:start-camera", openAttendancePage);
    return () => window.removeEventListener("netra:start-camera", openAttendancePage);
  }, [navigate]);

  return null;
}

const PULL_THRESHOLD = 48; // px of pull needed to flip the switch
const MIN_PULL = -72; // max upward travel
const MAX_PULL = 100; // max downward travel

function AuthLayout() {
  const { pathname } = useLocation();
  const [lampOn, setLampOn] = useState(false);
  const lampOnRef = useRef(false);
  const sceneRef = useRef(null);
  const lampRef = useRef(null);
  const bulbRef = useRef(null);
  const cardRef = useRef(null);
  const drag = useRef({
    active: false,
    id: null,
    startY: 0,
    scale: 1,
    done: false,
  });

  const setLamp = (on) => {
    lampOnRef.current = on;
    setLampOn(on);
  };

  useEffect(() => {
    if (pathname === "/admin/login") setLamp(true);
  }, [pathname]);

  const setPull = (distance) => {
    const d = Math.max(MIN_PULL, Math.min(MAX_PULL, distance));
    sceneRef.current.style.setProperty("--pull-distance", `${d}px`);
  };

  // Keep auth controls unavailable until the lamp is switched on.
  useEffect(() => {
    cardRef.current.inert = !lampOn;
  }, [lampOn]);

  // Keep the light glow centred on the bulb at every screen size
  useEffect(() => {
    const place = () => {
      const scene = sceneRef.current;
      const bulb = bulbRef.current;
      if (!scene || !bulb) return;
      const s = scene.getBoundingClientRect();
      const b = bulb.getBoundingClientRect();
      scene.style.setProperty(
        "--lamp-x",
        `${b.left + b.width / 2 - s.left}px`,
      );
      scene.style.setProperty(
        "--lamp-y",
        `${b.top + b.height / 2 - s.top}px`,
      );
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(sceneRef.current);
    window.addEventListener("load", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", place);
    };
  }, []);

  const onPointerDown = (e) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const lamp = lampRef.current;
    drag.current = {
      active: true,
      id: e.pointerId,
      startY: e.clientY,
      scale: lamp.getBoundingClientRect().width / lamp.offsetWidth || 1, // lamp is scaled on mobile
      done: false,
    };
    lamp.dataset.dragging = "true";
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;

    const movement = (e.clientY - d.startY) / d.scale; // Y only: no sideways movement
    setPull(movement);

    const on = lampOnRef.current;
    if (
      !d.done &&
      ((!on && movement >= PULL_THRESHOLD) ||
        (on && movement <= -PULL_THRESHOLD))
    ) {
      d.done = true; // switch only once per drag
      setLamp(!on);
    }
  };

  const finishPull = (e) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.id) return;
    d.active = false;
    lampRef.current.dataset.dragging = "false"; // re-enables the easing...
    setPull(0); // ...so the cord glides back to rest
  };

  // Keyboard: Down = on, Up = off, with a small tug
  const onKeyDown = (e) => {
    const on = lampOnRef.current;
    const turnOn = e.key === "ArrowDown" && !on;
    const turnOff = e.key === "ArrowUp" && on;
    if (!turnOn && !turnOff) return;
    e.preventDefault();
    setPull(turnOn ? -40 : 40);
    setLamp(turnOn);
    setTimeout(() => setPull(0), 160);
  };

  return (
    <main
      ref={sceneRef}
      className={`scene ${lampOn ? "light-on" : "light-off"}${pathname === "/login" || pathname === "/register" ? " scene--auth" : ""}`}
    >
      <section className="lamp-stage" aria-label="Pull-cord lamp">
        <div ref={lampRef} className="lamp" data-dragging="false">
          <div className="lamp-shade" />
          <div ref={bulbRef} className="lamp-bulb" />
          <div className="lamp-stand" />
          <div className="lamp-base" />
          <div
            className="cord"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishPull}
            onPointerCancel={finishPull}
            onLostPointerCapture={finishPull}
          >
            <div className="cord-line" />
            <button
              type="button"
              className="pull-knob"
              onKeyDown={onKeyDown}
              aria-label={
                lampOn
                  ? "Pull the cord up to turn off"
                  : "Pull the cord down to turn on"
              }
            />
          </div>
        </div>
        <p className="hint">Pull the cord down</p>
      </section>

      <section
        ref={cardRef}
        className={`login-container${pathname === "/login" ? " login-container--login" : ""}`}
        aria-hidden={!lampOn}
      >
        <div className="portal-brand" aria-label="Netra logo">
          <img className="portal-logo" src="/netra-logo.svg.png" alt="Netra" />
        </div>
        <h1 className="portal-title">SMART ATTENDANCE PORTAL</h1>
        <div className="page-content auth-route" key={pathname}>
          <Outlet />
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ButtonAnimation />
      <PageTransition />
      <AttendanceStartHandler />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="admin/login" element={<AdminLogin />} />
        </Route>
        <Route path="admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
        <Route element={<Protected role="student"><DashboardLayout /></Protected>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mark-attendance" element={<MarkAttendancePage />} />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<div className="analytics-loading" role="status">Loading analytics…</div>}>
                <AnalyticsPage />
              </Suspense>
            }
          />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
