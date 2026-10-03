import { useEffect, useRef, useState } from "react";
import {
  FiCamera,
  FiBriefcase,
  FiEdit2,
  FiFlag,
  FiGithub,
  FiLink,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { getSession } from "../auth";
import { MOCK_ATTENDANCE, MOCK_SUMMARY, fmtShort } from "./Dashboard";
import "./Dashboard.css";

export function MarkAttendancePage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraState, setCameraState] = useState("idle");

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }
    setCameraState("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraState("ready");
    } catch {
      setCameraState("denied");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  };

  return (
    <div className="dash-page-view subpage-view">
      <PageHeading eyebrow="TODAY" title="Mark attendance" copy="Check your camera before your session begins." />
      <section className="mark-attendance-layout">
        <div className="camera-panel">
          <div className={`camera-preview${cameraState === "ready" ? " live" : ""}`}>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" hidden={cameraState !== "ready"} />
            {cameraState !== "ready" && (
              <div className="camera-placeholder">
                <FiCamera size={36} aria-hidden="true" />
                <strong>{cameraState === "denied" ? "Camera access blocked" : "Camera preview"}</strong>
                <span>{cameraState === "unsupported" ? "Camera access is not supported in this browser." : "Your camera stays off until you start the check."}</span>
              </div>
            )}
          </div>
          <div className="camera-actions">
            <div>
              <strong>{cameraState === "ready" ? "Camera connected" : "Camera check"}</strong>
              <p>Preview only. Face recognition and attendance submission are not connected yet.</p>
            </div>
            {cameraState === "ready" ? (
              <button className="action-button secondary" type="button" onClick={stopCamera}>Stop camera</button>
            ) : (
              <button className="action-button" type="button" onClick={startCamera} disabled={cameraState === "loading" || cameraState === "unsupported"}>
                {cameraState === "loading" ? "Connecting…" : "Start camera"}
              </button>
            )}
          </div>
        </div>
        <aside className="panel checkin-panel">
          <p className="dash-eyebrow">CHECK-IN</p>
          <h2>Before you begin</h2>
          <div className="checkin-step"><span>01</span><p>Allow camera access for a clear preview.</p></div>
          <div className="checkin-step"><span>02</span><p>Position yourself in a well-lit space.</p></div>
          <div className="checkin-step"><span>03</span><p>Attendance can be submitted when identity verification is connected.</p></div>
          <div className="notice-line"><FiShield size={16} aria-hidden="true" /> Camera is only activated when you start it.</div>
        </aside>
      </section>
    </div>
  );
}

export function FriendsPage() {
  return (
    <div className="dash-page-view subpage-view">
      <PageHeading eyebrow="YOUR COMMUNITY" title="Friends" copy="Stay connected with your attendance group." />
      <section className="friends-banner">
        <div className="friends-symbol"><FiUser size={24} aria-hidden="true" /></div>
        <div><p className="dash-eyebrow">YOUR GROUP</p><h2>{MOCK_SUMMARY.friendsGroup}</h2><p>Friend profiles will appear here once the friends service is connected.</p></div>
      </section>
      <section className="panel friends-empty">
        <div className="friends-empty-mark"><FiUsers size={24} aria-hidden="true" /></div>
        <h2>Your people, in one place</h2>
        <p>There are no friend profiles to show yet.</p>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const user = getSession() || {};
  const inputRef = useRef(null);
  const [photo, setPhoto] = useState(() => localStorage.getItem("sa_profile_photo") || "");
  const [photoError, setPhotoError] = useState("");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(() => {
    try {
      return {
        year: "2nd Year",
        domain: "UI/UX Designing",
        ...JSON.parse(localStorage.getItem("sa_profile_details")),
      };
    } catch {
      return { year: "2nd Year", domain: "UI/UX Designing" };
    }
  });
  const [draft, setDraft] = useState(profile);
  const initials = (user.name || "S").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const absentRecords = MOCK_ATTENDANCE.filter((record) => record.status === "Absent");
  const lastAbsent = absentRecords.sort((a, b) => b.date.localeCompare(a.date))[0];

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
      image.onload = () => {
        const scale = Math.min(1, 640 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimizedPhoto = canvas.toDataURL("image/jpeg", 0.82);
        try {
          localStorage.setItem("sa_profile_photo", optimizedPhoto);
          setPhoto(optimizedPhoto);
          setPhotoError("");
        } catch {
          setPhotoError("The image could not be saved in this browser.");
        }
      };
      image.onerror = () => setPhotoError("This image could not be opened.");
      image.src = reader.result;
    };
    reader.onerror = () => setPhotoError("This image could not be read.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveProfile = (event) => {
    event.preventDefault();
    try {
      localStorage.setItem("sa_profile_details", JSON.stringify(draft));
      setProfile(draft);
      setEditing(false);
    } catch {
      setPhotoError("Profile details could not be saved in this browser.");
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
          <button className="profile-edit-button" type="submit">Save profile</button>
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