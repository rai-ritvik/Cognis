import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { getSession } from "../auth";
import "./Dashboard.css";

export const MOCK_ATTENDANCE = [
  { id: 1, date: "2026-09-30", event: "Lecture on AI", status: "Present" },
  { id: 2, date: "2026-09-23", event: "Task Evaluation", status: "Present" },
  { id: 3, date: "2026-09-18", event: "Pre Task Evaluation", status: "Present" },
  { id: 4, date: "2026-09-16", event: "Lecture on Time complexity", status: "Absent" },
  { id: 5, date: "2026-09-03", event: "Task Briefing", status: "Present" },
];

export const MOCK_EVENTS = [
  { id: 1, title: "Townhall", date: "2026-10-02" },
  { id: 2, title: "Rush Hour", date: "2026-10-20" },
];

export const MOCK_SUMMARY = {
  attendedClasses: 27,
  totalClasses: 38,
  presentToday: 1,
  totalToday: 1,
  friendsGroup: "Netra Members",
};

export const fmtShort = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getSession();
  const userName = user?.name || "Student";
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const percent = Math.round(
    (MOCK_SUMMARY.attendedClasses / MOCK_SUMMARY.totalClasses) * 100,
  );
  const todayPercent = Math.round(
    (MOCK_SUMMARY.presentToday / MOCK_SUMMARY.totalToday) * 100,
  );
  const attendanceDays = useMemo(() => {
    const byDate = new Map();
    for (const record of MOCK_ATTENDANCE) {
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
  }, []);
  const filteredAttendance = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MOCK_ATTENDANCE.filter((record) => {
      const dateMatches = !selectedDate || record.date === selectedDate;
      const queryMatches =
        !query ||
        record.event.toLowerCase().includes(query) ||
        record.status.toLowerCase().includes(query) ||
        record.date.includes(query) ||
        fmtShort(record.date).toLowerCase().includes(query);
      return dateMatches && queryMatches;
    });
  }, [search, selectedDate]);

  return (
    <div className="dash-page-view">
      <section className="dash-banner">
        <div>
          <p className="dash-eyebrow">ATTENDANCE OVERVIEW</p>
          <h1>Welcome, {userName}</h1>
          <p>Stay consistent. Keep showing up. You&apos;re doing great!</p>
        </div>
        <div className="banner-mark" aria-hidden="true">N</div>
      </section>

      <section className="dash-stats" aria-label="Attendance summary">
        <div className="stat-card">
          <FiCalendar className="stat-icon" size={18} aria-hidden="true" />
          <span className="stat-label">Total Attendance</span>
          <strong className="stat-value">{percent}%</strong>
          <span className="stat-sub">{MOCK_SUMMARY.attendedClasses}/{MOCK_SUMMARY.totalClasses} classes</span>
        </div>
        <div className="stat-card">
          <FiCheckSquare className="stat-icon" size={18} aria-hidden="true" />
          <span className="stat-label">Present Today</span>
          <strong className="stat-value">{MOCK_SUMMARY.presentToday}/{MOCK_SUMMARY.totalToday}</strong>
          <span className="stat-sub">{todayPercent}% attendance</span>
        </div>
        <div className="stat-card">
          <FiClock className="stat-icon" size={18} aria-hidden="true" />
          <span className="stat-label">Upcoming Events</span>
          <strong className="stat-value">{MOCK_EVENTS.length}</strong>
          <span className="stat-sub">In this month</span>
        </div>
        <div className="stat-card">
          <FiUsers className="stat-icon" size={18} aria-hidden="true" />
          <span className="stat-label">Your Friends</span>
          <strong className="stat-value stat-value-sm">{MOCK_SUMMARY.friendsGroup}</strong>
          <button className="stat-link" type="button" onClick={() => navigate("/friends")}>
            Open friends <FiArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </section>

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
            <span className="day-tile-weekday">VIEW</span><strong>All days</strong><span className="day-tile-status">{MOCK_ATTENDANCE.length} records</span>
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
          {filteredAttendance.length === 0 ? <p className="empty">No attendance found for this date.</p> : filteredAttendance.map((record) => {
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
          {MOCK_EVENTS.map((event, index) => (
            <div className="event-item" key={event.id}>
              <span className="event-num">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{event.title}</strong><small>{fmtShort(event.date)}</small></div>
            </div>
          ))}
        </div>
        <button className="mark-card" type="button" onClick={() => navigate("/mark-attendance")}>
          <span className="mark-card-icon"><FiCalendar size={20} aria-hidden="true" /></span>
          <span className="mark-card-copy"><strong>Mark attendance</strong><small>Open today&apos;s check-in</small></span>
          <FiArrowRight size={20} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

