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
import { MOCK_ATTENDANCE, MOCK_SUMMARY, fmtShort } from "./Dashboard";
import "./Dashboard.css";

export default function AnalyticsPage() {
  const present = MOCK_ATTENDANCE.filter((record) => record.status === "Present").length;
  const absent = MOCK_ATTENDANCE.length - present;
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
        <Metric label="Overall attendance" value={`${attendanceRate}%`} detail={`${MOCK_SUMMARY.attendedClasses} of ${MOCK_SUMMARY.totalClasses} classes`} />
        <Metric label="Present sessions" value={present} detail="In the recent sample" />
        <Metric label="Absent sessions" value={absent} detail="In the recent sample" />
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

function Metric({ label, value, detail }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}