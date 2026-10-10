import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { afterButtonAnimation } from "../ButtonAnimation";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { getMyHome, getSession } from "../auth";
import "./Dashboard.css";

export const fmtShort = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function CountUp({ end }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return undefined;
    }

    let frameId;
    let startTime;
    const duration = 1200;
    const step = (timestamp) => {
      if (startTime === undefined) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.round(end * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [end]);

  return <>{value}</>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getSession();
  const userName = user?.name || "Student";
  const [homeData, setHomeData] = useState(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    let isCurrent = true;
    getMyHome()
      .then((data) => {
        if (isCurrent) {
          setHomeData(data);
          setHomeError("");
        }
      })
      .catch((error) => {
        if (isCurrent) setHomeError(error.message || "Could not load your dashboard.");
      })
      .finally(() => {
        if (isCurrent) setHomeLoading(false);
      });
    return () => { isCurrent = false; };
  }, []);

  const attendance = homeData?.attendance || [];
  const events = homeData?.events || [];
  const summary = homeData?.summary || {
    attendedClasses: 0,
    totalClasses: 0,
    presentToday: 0,
    totalToday: 0,
    friendsCount: 0,
  };
  const percent = summary.totalClasses
    ? Math.round((summary.attendedClasses / summary.totalClasses) * 100)
    : 0;
  const todayPercent = summary.totalToday
    ? Math.round((summary.presentToday / summary.totalToday) * 100)
    : 0;
  const attendanceDays = useMemo(() => {
    const byDate = new Map();
    for (const record of attendance) {
      const records = byDate.get(record.date) || [];
      records.push(record);
      byDate.set(record.date, records);
    }
    return [...byDate.entries()]
      .map(([date, records]) => ({
        date,
        status: records.every((record) => record.status === "Present")
          ? "Present"
          : "Absent",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);
  const filteredAttendance = useMemo(() => {
    const query = search.trim().toLowerCase();
    return attendance.filter((record) => {
      const dateMatches = !selectedDate || record.date === selectedDate;
      const queryMatches =
        !query ||
        record.event.toLowerCase().includes(query) ||
        record.status.toLowerCase().includes(query) ||
        record.date.includes(query) ||
        fmtShort(record.date).toLowerCase().includes(query);
      return dateMatches && queryMatches;
    });
  }, [attendance, search, selectedDate]);

  return (
    <div className="dash-page-view home-page-view">
      <div className="home-content-layer">
        <div className="banner-glow-frame">
          <section className="dash-banner">
          <span className="banner-light-sweep" aria-hidden="true" />
          <span className="banner-spark banner-spark-1" aria-hidden="true">✦</span>
          <span className="banner-spark banner-spark-2" aria-hidden="true">✦</span>
          <span className="banner-spark banner-spark-3" aria-hidden="true">✦</span>
          <span className="banner-spark banner-spark-4" aria-hidden="true">✦</span>
          <span className="banner-spark banner-spark-5" aria-hidden="true">✦</span>
          <div>
            <p className="dash-eyebrow">ATTENDANCE OVERVIEW</p>
            <h1>Welcome, {userName}</h1>
            <p>Stay consistent. Keep showing up. You&apos;re doing great!</p>
          </div>
        </section>

        <section className="dash-stats grid" aria-label="Attendance summary">
          <div className="stat-card" role="group" aria-label={`Total attendance: ${percent} percent, ${summary.attendedClasses} of ${summary.totalClasses} classes`}>
            <FiCalendar className="stat-icon" size={18} aria-hidden="true" />
            <span className="stat-label">Total Attendance</span>
            <strong className="stat-value"><CountUp end={percent} />%</strong>
            <span className="stat-sub">{summary.attendedClasses}/{summary.totalClasses} classes</span>
          </div>
          <div className="stat-card" role="group" aria-label={`Present today: ${summary.presentToday} of ${summary.totalToday} classes, ${todayPercent} percent`}>
            <FiCheckSquare className="stat-icon" size={18} aria-hidden="true" />
            <span className="stat-label">Present Today</span>
            <strong className="stat-value"><CountUp end={summary.presentToday} />/<CountUp end={summary.totalToday} /></strong>
            <span className="stat-sub">{todayPercent}% attendance</span>
          </div>
          <div className="stat-card" role="group" aria-label={`Upcoming events: ${events.length}`}>
            <FiClock className="stat-icon" size={18} aria-hidden="true" />
            <span className="stat-label">Upcoming Events</span>
            <strong className="stat-value"><CountUp end={events.length} /></strong>
            <span className="stat-sub">In this month</span>
          </div>
          <div className="stat-card" role="group" aria-label={`Your friends: ${summary.friendsCount}`}>
            <FiUsers className="stat-icon" size={18} aria-hidden="true" />
            <span className="stat-label">Your Friends</span>
            <strong className="stat-value stat-value-sm">{summary.friendsCount}</strong>
            <button className="stat-link" type="button" onClick={() => navigate("/friends")}>
              Open friends <FiArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
          </section>
        </div>

        {homeError && <div className="attendance-checkin-message is-error" role="alert">{homeError}</div>}
        {homeLoading && <p className="empty" role="status">Loading your attendance data…</p>}

        <section className="attendance-panel panel">
          <div className="attendance-heading">
            <div><p className="dash-eyebrow">YOUR HISTORY</p><h2 className="panel-title">Find a day</h2></div>
            <label className="date-picker">
              <span>Date</span>
              <input aria-label="Filter attendance by date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>

          <div className="attendance-days" aria-label="Days with attendance records">
            <button className={`day-tile day-all${selectedDate ? "" : " selected"}`} type="button" onClick={() => setSelectedDate("")}>
              <span className="day-tile-weekday">VIEW</span><strong>All days</strong><span className="day-tile-status">{attendance.length} records</span>
            </button>
            {attendanceDays.map((day) => {
              const date = new Date(`${day.date}T00:00:00`);
              return (
                <button className={`day-tile${selectedDate === day.date ? " selected" : ""}`} type="button" key={day.date} onClick={() => setSelectedDate(day.date)} aria-pressed={selectedDate === day.date}>
                  <span className="day-tile-weekday">{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <strong>{date.toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</strong>
                  <span className={`day-tile-status ${day.status.toLowerCase()}`}>{day.status}</span>
                </button>
              );
            })}
          </div>

          <div className="attendance-heading attendance-results-heading">
            <div>
              <h2 className="panel-title">Attendance records</h2>
              <p className="attendance-hint">{selectedDate ? fmtShort(selectedDate) : "Search by session, status, or date"}</p>
            </div>
            <label className="dash-search attendance-search">
              <FiSearch size={16} aria-hidden="true" />
              <input type="search" placeholder="Search records" aria-label="Search attendance records" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>

          <div className="attendance-list" aria-live="polite">
            {filteredAttendance.length === 0 ? <p className="empty">{homeLoading ? "Loading attendance records…" : "No attendance found for this date."}</p> : filteredAttendance.map((record) => {
              const date = new Date(`${record.date}T00:00:00`);
              return (
                <article className="attendance-row" key={record.id}>
                  <div className="attendance-date-stamp"><strong>{date.getDate()}</strong><span>{date.toLocaleDateString("en-US", { month: "short" })}</span></div>
                  <div className="attendance-event"><strong>{record.event}</strong><span>{fmtShort(record.date)}</span></div>
                  <em className={`badge ${record.status.toLowerCase()}`}>{record.status}</em>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dash-lower home-lower">
          <div className="panel events">
            <div className="attendance-heading"><div><p className="dash-eyebrow">COMING UP</p><h2 className="panel-title">Upcoming events</h2></div></div>
            {events.map((event, index) => (
              <div className="event-item" key={event.id}>
                <span className="event-num">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{event.title}</strong><small>{fmtShort(event.date)}</small></div>
              </div>
            ))}
            {!homeLoading && !homeError && events.length === 0 && <p className="empty">No upcoming events.</p>}
          </div>
          <button
            className="mark-card"
            type="button"
            data-button-animation
            data-animation-style="bubbles"
            onClick={() => afterButtonAnimation(() => navigate("/mark-attendance"))}
          >
            <span className="mark-card-decoration" aria-hidden="true">
              <span className="mark-bubble mark-bubble-1" />
              <span className="mark-bubble mark-bubble-2" />
              <span className="mark-bubble mark-bubble-3" />
              <span className="mark-bubble mark-bubble-4" />
              <span className="mark-bubble mark-bubble-5" />
              <span className="mark-star mark-star-1">✦</span>
              <span className="mark-star mark-star-2">✦</span>
              <span className="mark-star mark-star-3">✦</span>
            </span>
            <span className="mark-card-icon"><FiCalendar size={20} aria-hidden="true" /></span>
            <span className="mark-card-copy">
              <strong>Mark attendance</strong>
              <small>Open today&apos;s check-in</small>
            </span>
            <FiArrowRight className="mark-card-arrow" size={20} aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}
