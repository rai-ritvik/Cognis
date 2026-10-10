import { useEffect, useState } from "react";
import {
  cancelAdminEvent,
  cancelAdminSchedule,
  createAdminEvent,
  createAdminSchedule,
  getAdminAnalytics,
  getAdminEvents,
  getAdminFlags,
  getAdminReviews,
  getAdminSchedules,
  reviewAttendance,
  setAttendanceFlag,
} from "../auth";

function WorkflowPage({ eyebrow, title, description, error, notice, children }) {
  return (
    <section className="admin-workflow-view">
      <header className="admin-workflow-heading">
        <div>
          <p className="admin-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      {error && <div className="admin-feedback is-error" role="alert">{error}</div>}
      {notice && <div className="admin-feedback is-success" role="status">{notice}</div>}
      {children}
    </section>
  );
}

function useWorkflowData(loader, emptyValue) {
  const [data, setData] = useState(emptyValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Could not load this admin page.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);
  return { data, setData, loading, error, setError, refresh };
}

function ReviewQueuePage() {
  const { data, loading, error, setError, refresh } = useWorkflowData(getAdminReviews, { reviews: [] });
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const decide = async (review, decision) => {
    const reason = decision === "REJECTED"
      ? window.prompt("Enter a reason for rejecting this attendance:")
      : "";
    if (decision === "REJECTED" && !reason?.trim()) return;
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewAttendance(review.id, decision, reason || "");
      setNotice(result.message);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not update the attendance review.");
    } finally {
      setBusyId("");
    }
  };

  const flag = async (review) => {
    const reason = window.prompt("Why should this attendance remain flagged?");
    if (!reason?.trim()) return;
    setBusyId(review.id);
    setError("");
    setNotice("");
    try {
      const result = await setAttendanceFlag(review.id, true, reason);
      setNotice(result.message);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not flag this attendance.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <WorkflowPage
      eyebrow="ATTENDANCE OVERSIGHT"
      title="Review queue"
      description="Review verified check-ins and their privately stored evidence before approval."
      error={error}
      notice={notice}
    >
      <div className="admin-workflow-actions"><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-empty-state" role="status">Loading review queue…</p> : data.reviews.length === 0 ? (
        <p className="admin-empty-state">There are no attendance records waiting for review.</p>
      ) : data.reviews.map((review) => (
        <article className="admin-workflow-card admin-review-card" key={review.id}>
          <div className="admin-review-evidence">
            {review.photo_url
              ? <img src={review.photo_url} alt={`Check-in evidence for ${review.student?.full_name || "student"}`} />
              : <p>Evidence photo unavailable</p>}
          </div>
          <div className="admin-review-details">
            <p className="admin-eyebrow">{review.session?.title || "Attendance session"}</p>
            <h2>{review.student?.full_name || "Student"}</h2>
            <p>Student number: {review.student?.roll_number || "—"}</p>
            <p>Checked in: {review.created_at ? new Date(review.created_at).toLocaleString() : "—"}</p>
            {review.flagged && <p className="admin-workflow-warning">Flagged: {review.flag_reason}</p>}
            <div className="admin-workflow-actions">
              <button type="button" onClick={() => decide(review, "APPROVED")} disabled={busyId === review.id}>Approve</button>
              <button type="button" className="secondary" onClick={() => decide(review, "REJECTED")} disabled={busyId === review.id}>Reject</button>
              {!review.flagged && <button type="button" className="secondary" onClick={() => flag(review)} disabled={busyId === review.id}>Flag</button>}
            </div>
          </div>
        </article>
      ))}
    </WorkflowPage>
  );
}

function FlagsPage() {
  const { data, loading, error, setError, refresh } = useWorkflowData(getAdminFlags, { flags: [] });
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const clearFlag = async (record) => {
    setBusyId(record.id);
    setError("");
    try {
      const result = await setAttendanceFlag(record.id, false);
      setNotice(result.message);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not remove the attendance flag.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <WorkflowPage eyebrow="ATTENDANCE OVERSIGHT" title="Flags" description="Investigate check-ins that an administrator has marked for follow-up." error={error} notice={notice}>
      <div className="admin-workflow-actions"><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-empty-state" role="status">Loading flags…</p> : data.flags.length === 0 ? (
        <p className="admin-empty-state">There are no flagged check-ins.</p>
      ) : data.flags.map((record) => (
        <article className="admin-workflow-card admin-review-card" key={record.id}>
          <div className="admin-review-evidence">
            {record.photo_url ? <img src={record.photo_url} alt={`Flagged check-in for ${record.student?.full_name || "student"}`} /> : <p>Evidence photo unavailable</p>}
          </div>
          <div className="admin-review-details">
            <p className="admin-eyebrow">{record.session?.title || "Attendance session"}</p>
            <h2>{record.student?.full_name || "Student"}</h2>
            <p>Student number: {record.student?.roll_number || "—"}</p>
            <p className="admin-workflow-warning">{record.flag_reason}</p>
            <button className="admin-workflow-button secondary" type="button" onClick={() => clearFlag(record)} disabled={busyId === record.id}>Clear flag</button>
          </div>
        </article>
      ))}
    </WorkflowPage>
  );
}

function AnalyticsPage() {
  const { data, loading, error, refresh } = useWorkflowData(getAdminAnalytics, null);
  return (
    <WorkflowPage eyebrow="ADMINISTRATION" title="Attendance analytics" description="Current system-wide attendance and review totals." error={error}>
      <div className="admin-workflow-actions"><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-empty-state" role="status">Loading analytics…</p> : data && (
        <div className="admin-workflow-stat-grid">
          {[
            ["Registered students", data.members],
            ["Sessions", data.sessions],
            ["Present check-ins", data.present],
            ["Pending reviews", data.pending_reviews],
            ["Flagged records", data.flagged],
          ].map(([label, value]) => (
            <article className="admin-workflow-card admin-workflow-stat" key={label}>
              <span>{label}</span><strong>{value}</strong>
            </article>
          ))}
        </div>
      )}
    </WorkflowPage>
  );
}

function EventsPage() {
  const { data, loading, error, setError, refresh } = useWorkflowData(getAdminEvents, { events: [] });
  const [form, setForm] = useState({ title: "", description: "", startsAt: "", endsAt: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createAdminEvent({
        title: form.title,
        description: form.description,
        starts_at: new Date(form.startsAt).toISOString(),
        ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
      setNotice(`Created ${result.event.title}.`);
      setForm({ title: "", description: "", startsAt: "", endsAt: "" });
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not create the event.");
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (eventId) => {
    setBusy(true);
    setError("");
    try {
      const result = await cancelAdminEvent(eventId);
      setNotice(result.message);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not cancel the event.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkflowPage eyebrow="ADMINISTRATION" title="Events" description="Publish upcoming events for the student Home page." error={error} notice={notice}>
      <form className="admin-workflow-form" onSubmit={submit}>
        <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required /></label>
        <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} rows={2} /></label>
        <label>Starts at<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label>
        <label>Ends at (optional)<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <button type="submit" disabled={busy}>Publish event</button>
      </form>
      <div className="admin-workflow-actions"><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-empty-state" role="status">Loading events…</p> : data.events.length === 0 ? <p className="admin-empty-state">No events yet.</p> : data.events.map((event) => (
        <article className="admin-workflow-card admin-event-row" key={event.id}>
          <div><h2>{event.title}</h2><p>{new Date(event.starts_at).toLocaleString()} · {event.status}</p>{event.description && <p>{event.description}</p>}</div>
          {event.status === "PUBLISHED" && <button className="admin-workflow-button secondary" type="button" onClick={() => cancel(event.id)} disabled={busy}>Cancel</button>}
        </article>
      ))}
    </WorkflowPage>
  );
}

function SchedulePage() {
  const { data, loading, error, setError, refresh } = useWorkflowData(getAdminSchedules, { schedules: [] });
  const [form, setForm] = useState({ title: "", scheduledAt: "", latitude: "", longitude: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createAdminSchedule({
        title: form.title,
        scheduled_at: new Date(form.scheduledAt).toISOString(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      setNotice(`Scheduled ${result.schedule.title}. It will open automatically when its start time arrives.`);
      setForm({ title: "", scheduledAt: "", latitude: "", longitude: "" });
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not schedule the session.");
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (scheduleId) => {
    setBusy(true);
    setError("");
    try {
      const result = await cancelAdminSchedule(scheduleId);
      setNotice(result.message);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Could not cancel the scheduled session.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkflowPage eyebrow="ATTENDANCE MANAGEMENT" title="Schedule session" description="Set a future start time and class location. Scheduled sessions open automatically when no other session is active." error={error} notice={notice}>
      <form className="admin-workflow-form admin-schedule-form" onSubmit={submit}>
        <label>Session title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required /></label>
        <label>Starts at<input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} required /></label>
        <label>Latitude<input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required /></label>
        <label>Longitude<input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required /></label>
        <button type="submit" disabled={busy}>Schedule session</button>
      </form>
      <div className="admin-workflow-actions"><button type="button" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p className="admin-empty-state" role="status">Loading schedules…</p> : data.schedules.length === 0 ? <p className="admin-empty-state">No scheduled sessions.</p> : data.schedules.map((schedule) => (
        <article className="admin-workflow-card admin-event-row" key={schedule.id}>
          <div><h2>{schedule.title}</h2><p>{new Date(schedule.scheduled_at).toLocaleString()} · {schedule.status}</p></div>
          {schedule.status === "PENDING" && <button className="admin-workflow-button secondary" type="button" onClick={() => cancel(schedule.id)} disabled={busy}>Cancel</button>}
        </article>
      ))}
    </WorkflowPage>
  );
}

export default function AdminWorkflows({ pathname }) {
  if (pathname === "/admin/review") return <ReviewQueuePage />;
  if (pathname === "/admin/flags") return <FlagsPage />;
  if (pathname === "/admin/analytics") return <AnalyticsPage />;
  if (pathname === "/admin/events") return <EventsPage />;
  if (pathname === "/admin/schedule") return <SchedulePage />;
  return <WorkflowPage eyebrow="ADMINISTRATION" title="Page not found" description="This admin page does not exist." />;
}
