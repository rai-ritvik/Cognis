import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiPercent } from "react-icons/fi";
import { MOCK_ATTENDANCE, MOCK_SUMMARY, fmtShort } from "./Dashboard";
import "./Dashboard.css";

export default function AnalyticsPage() {
  const present = MOCK_ATTENDANCE.filter((record) => record.status === "Present").length;
  const absent = MOCK_ATTENDANCE.length - present;
  const monthlySummary = [...MOCK_ATTENDANCE.reduce((months, record) => {
    const month = record.date.slice(0, 7);
    const summary = months.get(month) || { month, present: 0, total: 0 };
    summary.total += 1;
    if (record.status === "Present") summary.present += 1;
    months.set(month, summary);
    return months;
  }, new Map()).values()].sort((a, b) => b.month.localeCompare(a.month))[0];
  const monthlyRate = monthlySummary
    ? Math.round((monthlySummary.present / monthlySummary.total) * 100)
    : 0;
  const monthlyLabel = monthlySummary
    ? new Date(`${monthlySummary.month}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : "No sessions yet";
  const latestMissed = [...MOCK_ATTENDANCE]
    .filter((record) => record.status === "Absent")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestMissedDay = latestMissed
    ? MOCK_ATTENDANCE.filter(
        (record) => record.status === "Absent" && record.date === latestMissed.date,
      )
    : [];
  const sessionTrend = [...MOCK_ATTENDANCE]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({
      date: new Date(`${record.date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      attendance: record.status === "Present" ? 100 : 0,
      session: record.event,
    }));
  const dailyCounts = [...MOCK_ATTENDANCE.reduce((days, record) => {
    const date = new Date(`${record.date}T00:00:00`);
    const day = days.get(record.date) || {
      date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      present: 0,
      absent: 0,
    };
    day[record.status.toLowerCase()] += 1;
    days.set(record.date, day);
    return days;
  }, new Map()).values()];
  const distribution = [
    { name: "Present", value: present, color: "#34845b" },
    { name: "Absent", value: absent, color: "#bd5148" },
  ];
  const attendanceRate = Math.round(
    (MOCK_SUMMARY.attendedClasses / MOCK_SUMMARY.totalClasses) * 100,
  );

  return (
    <div className="dash-page-view subpage-view">
      <header className="subpage-heading">
        <p className="dash-eyebrow">YOUR PROGRESS</p>
        <h1>Attendance analytics</h1>
        <p>Explore recent trends and session outcomes.</p>
      </header>

      <section className="analytics-stats">
        <article className="analytics-overview-card monthly-overview">
          <div className="overview-card-heading">
            <span className="overview-card-icon"><FiCalendar aria-hidden="true" /></span>
            <div><p className="dash-eyebrow">MONTHLY PRESENCE</p><h2>{monthlyLabel}</h2></div>
          </div>
          <div className="monthly-attendance-value">
            <strong>{monthlySummary ? `${monthlySummary.present}/${monthlySummary.total}` : "0/0"}</strong>
            <span>sessions attended</span>
          </div>
          <div
            className="attendance-progress"
            role="progressbar"
            aria-label={`${monthlyLabel} attendance`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={monthlyRate}
          >
            <span style={{ width: `${monthlyRate}%` }} />
          </div>
          <p className="overview-card-footnote">
            {monthlySummary ? `${monthlyRate}% attendance for the month` : "No sessions recorded this month"}
          </p>
        </article>

        <article className="analytics-overview-card summary-overview">
          <div className="overview-card-heading">
            <span className="overview-card-icon"><FiCheckCircle aria-hidden="true" /></span>
            <div><p className="dash-eyebrow">ATTENDANCE SUMMARY</p><h2>Overall progress</h2></div>
          </div>
          <div className="summary-counts">
            <div><span>Present</span><strong>{MOCK_SUMMARY.attendedClasses}</strong></div>
            <div><span>Absent</span><strong>{MOCK_SUMMARY.totalClasses - MOCK_SUMMARY.attendedClasses}</strong></div>
            <div><span>Total sessions</span><strong>{MOCK_SUMMARY.totalClasses}</strong></div>
          </div>
        </article>

        <article className="analytics-overview-card percentage-overview">
          <div className="overview-card-heading">
            <span className="overview-card-icon"><FiPercent aria-hidden="true" /></span>
            <div><p className="dash-eyebrow">ATTENDANCE RATE</p><h2>Overall attendance</h2></div>
          </div>
          <div className="attendance-gauge-wrap">
            <div
              className="attendance-gauge"
              role="progressbar"
              aria-label="Overall attendance"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={attendanceRate}
              style={{ "--attendance-rate": `${attendanceRate}%` }}
            >
              <span>{attendanceRate}%</span>
            </div>
          </div>
          <p className="overview-card-footnote">
            {MOCK_SUMMARY.attendedClasses} of {MOCK_SUMMARY.totalClasses} classes attended
          </p>
        </article>

        <article className="analytics-overview-card alert-overview">
          <div className="overview-card-heading">
            <span className="overview-card-icon"><FiAlertCircle aria-hidden="true" /></span>
            <div><p className="dash-eyebrow">ATTENDANCE ALERT</p><h2>{latestMissed ? "Missed class" : "All caught up"}</h2></div>
          </div>
          {latestMissed ? (
            <>
              <p className="missed-class-date">{fmtShort(latestMissed.date)}</p>
              <ul className="missed-class-list">
                {latestMissedDay.map((record) => <li key={record.id}>{record.event}</li>)}
              </ul>
              <p className="overview-card-footnote">
                {latestMissedDay.length > 1
                  ? `${latestMissedDay.length} classes missed that day`
                  : "Most recent missed class"}
              </p>
            </>
          ) : (
            <p className="missed-class-empty">There are no missed classes in your attendance records.</p>
          )}
        </article>
      </section>

      <section className="analytics-chart-grid">
        <article className="panel analytics-panel trend-panel">
          <div className="chart-heading">
            <div><p className="dash-eyebrow">SESSION TREND</p><h2 className="panel-title">Recent attendance rate</h2></div>
            <span className="chart-note">Target: 75%</span>
          </div>
          <p className="chart-caption">Attendance outcome for each recorded session</p>
          <div className="chart-canvas trend-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionTrend} margin={{ top: 12, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#eee8e2" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#777", fontSize: 11 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: "#777", fontSize: 10 }} />
                <Tooltip formatter={(value, _name, item) => [`${value}%`, item.payload.session]} />
                <ReferenceLine y={75} stroke="#ba8a55" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="attendance" name="Attendance" stroke="#7d0a0a" strokeWidth={3} dot={{ r: 4, fill: "#fff", stroke: "#7d0a0a", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel analytics-panel distribution-panel">
          <div className="chart-heading"><div><p className="dash-eyebrow">DISTRIBUTION</p><h2 className="panel-title">Present vs absent</h2></div></div>
          <p className="chart-caption">Recent sample of {MOCK_ATTENDANCE.length} sessions</p>
          <div className="chart-canvas distribution-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="82%" paddingAngle={4} stroke="none">
                  {distribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  <Label value={`${Math.round((present / MOCK_ATTENDANCE.length) * 100)}%`} position="center" className="donut-label" />
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} sessions`, name]} />
                <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel analytics-panel daily-panel">
          <div className="chart-heading"><div><p className="dash-eyebrow">DAILY BREAKDOWN</p><h2 className="panel-title">Sessions by day</h2></div></div>
          <p className="chart-caption">Compare present and absent records across dates</p>
          <div className="chart-canvas daily-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCounts} margin={{ top: 12, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#eee8e2" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#777", fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#777", fontSize: 10 }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="present" name="Present" fill="#34845b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#bd5148" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="panel analytics-records">
        <div className="chart-heading"><div><p className="dash-eyebrow">SOURCE RECORDS</p><h2 className="panel-title">Recent sessions</h2></div><span className="data-note">Sample data</span></div>
        {MOCK_ATTENDANCE.map((record) => (
          <div className="attendance-row" key={record.id}>
            <div className="attendance-event"><strong>{record.event}</strong><span>{fmtShort(record.date)}</span></div>
            <em className={`badge ${record.status.toLowerCase()}`}>{record.status}</em>
          </div>
        ))}
      </section>
    </div>
  );
}