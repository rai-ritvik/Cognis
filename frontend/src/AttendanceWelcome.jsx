import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiCamera,
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiEye,
  FiMapPin,
  FiUser,
} from "react-icons/fi";
import "./AttendanceWelcome.css";

const PULL_THRESHOLD = 105;
const RING_CIRCUMFERENCE = 163.4;
const INTRO_DURATION = 1_300;
const STEP_DURATION = 1_750;
const ISSUE_INTRO_DURATION = 650;
const ISSUE_STEP_DURATION = 500;

const STEPS = [
  {
    Icon: FiCamera,
    title: "Camera check",
    description: "A camera preview can help you get ready to check in.",
    status: "Camera preview",
  },
  {
    Icon: FiUser,
    title: "Face match",
    description: "Identity checks help make attendance more reliable.",
    status: "Face check preview",
  },
  {
    Icon: FiEye,
    title: "Live presence",
    description: "Liveness checks are designed to reject photos and screens.",
    status: "Liveness preview",
  },
  {
    Icon: FiMapPin,
    title: "Class location",
    description: "Location checks help confirm you are at the right place.",
    status: "Location preview",
  },
  {
    Icon: FiCheckCircle,
    title: "Ready to check in",
    description: "Continue to the attendance page to begin the real check-in.",
    status: "Preview complete",
  },
];

function openAttendancePage() {
  window.dispatchEvent(new Event("netra:start-camera"));
}

export default function AttendanceWelcome({
  studentName,
  issueMessage = "",
  showPullCard = true,
  onIssueComplete,
}) {
  const cardRef = useRef(null);
  const closeButtonRef = useRef(null);
  const hadDialogRef = useRef(false);
  const dragRef = useRef({ active: false, pointerId: null, startY: 0, distance: 0 });
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("preview");
  const issueMode = mode === "issue";

  const finishIssue = useCallback(() => {
    setIsOpen(false);
    onIssueComplete?.();
  }, [onIssueComplete]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      hadDialogRef.current = true;
    } else if (hadDialogRef.current) {
      cardRef.current?.focus();
      hadDialogRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step === null) return undefined;
    if (issueMode && step >= STEPS.length) {
      const timeout = window.setTimeout(finishIssue, 850);
      return () => window.clearTimeout(timeout);
    }
    if (step >= STEPS.length) return undefined;
    const duration = issueMode
      ? step === 0 ? ISSUE_INTRO_DURATION : ISSUE_STEP_DURATION
      : step === 0 ? INTRO_DURATION : STEP_DURATION;
    const timeout = window.setTimeout(() => {
      setStep((current) => current < STEPS.length ? current + 1 : current);
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [finishIssue, isOpen, issueMode, step]);

  useEffect(() => {
    if (showPullCard) return;
    if (!issueMessage) {
      if (issueMode) finishIssue();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onIssueComplete?.();
      return;
    }
    setMode("issue");
    setStep(0);
    setIsOpen(true);
  }, [finishIssue, issueMessage, issueMode, onIssueComplete, showPullCard]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (issueMode) finishIssue();
        else setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishIssue, isOpen, issueMode]);

  const startAnimation = () => {
    setPullDistance(0);
    setIsDragging(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      openAttendancePage();
      return;
    }

    setMode("preview");
    setStep(0);
    setIsOpen(true);
  };

  const onPointerDown = (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      distance: 0,
    };
    setIsDragging(true);
    cardRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    setPullDistance(drag.distance);
  };

  const onPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    setIsDragging(false);
    if (drag.distance >= PULL_THRESHOLD) {
      startAnimation();
    } else {
      setPullDistance(0);
    }
  };

  const onKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    startAnimation();
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const resistedPull = 210 * (1 - Math.exp(-pullDistance / 210));
  const activeStep = step > 0 ? STEPS[step - 1] : null;
  const ActiveIcon = activeStep?.Icon;

  return (
    <>
      {showPullCard && <div className="attendance-pull-area">
        <div
          className={`attendance-pull-reveal${pullProgress >= 1 ? " ready" : ""}${isDragging ? " dragging" : ""}`}
          style={{ height: `${resistedPull}px` }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 64 64">
            <circle className="attendance-pull-track" cx="32" cy="32" r="26" />
            <circle
              className="attendance-pull-ring"
              cx="32"
              cy="32"
              r="26"
              style={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - pullProgress) }}
            />
          </svg>
          <p>{pullProgress >= 1 ? "Release to begin" : pullProgress > 0.55 ? "Almost there…" : "Pull down to begin"}</p>
        </div>
        <div
          ref={cardRef}
          className={`mark-card attendance-pull-card${isDragging ? " dragging" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Pull down to preview attendance check-in. Press Enter or Space to start."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          onKeyDown={onKeyDown}
          style={{ transform: `translateY(${resistedPull}px)` }}
        >
          <span className="attendance-pull-grab" aria-hidden="true" />
          <span className="mark-card-icon"><FiCamera size={22} aria-hidden="true" /></span>
          <span className="mark-card-copy">
            <strong>Mark attendance</strong>
            <small>Pull this card down to begin</small>
          </span>
          <span className="attendance-pull-arrow" aria-hidden="true">↓</span>
        </div>
      </div>}

      {isOpen && (
        <div className="welcome-animation" role="dialog" aria-modal="true" aria-label={issueMode ? "Attendance issue details" : "Netra attendance check-in preview"}>
          <div className="welcome-animation__grid" aria-hidden="true" />
          <div className="welcome-animation__orb welcome-animation__orb--one" aria-hidden="true" />
          <div className="welcome-animation__orb welcome-animation__orb--two" aria-hidden="true" />
          <button
            ref={closeButtonRef}
            className="welcome-animation__close"
            type="button"
            aria-label="Close attendance preview"
            onClick={() => issueMode ? finishIssue() : setIsOpen(false)}
          >
            ×
          </button>

          {step === 0 ? (
            <section className="welcome-animation__intro" key="intro">
              <svg className="welcome-animation__eye" viewBox="0 0 120 80" aria-hidden="true">
                <path d="M6 40 Q60 -8 114 40 Q60 88 6 40 Z" pathLength="1" />
                <circle className="iris" cx="60" cy="40" r="19" />
                <circle className="pupil" cx="60" cy="40" r="8" />
              </svg>
              <h2>Welcome, <span>{studentName || "Student"}</span></h2>
              <p>{issueMode ? "Let’s look at a few things that can interrupt check-in." : "Here&apos;s a quick look at checking in with Netra."}</p>
            </section>
          ) : (
            <section className={`welcome-animation__flow step-${step}`} key={step}>
              <div className="welcome-animation__steps" aria-label="Preview steps">
                {STEPS.map((item, index) => (
                  <div
                    className={`welcome-animation__step${step === index + 1 ? " active" : ""}${step > index + 1 ? " done" : ""}`}
                    key={item.title}
                  >
                    <span>{step > index + 1 ? <FiCheck aria-hidden="true" /> : index + 1}</span>
                    <div><strong>{item.title}</strong></div>
                  </div>
                ))}
              </div>

              <div className="welcome-animation__stage">
                <div className="welcome-animation__scene" aria-live="polite">
                  <div className="welcome-animation__visual">
                    {step === 3 ? (
                      <div className="welcome-animation__face">
                        <span className="welcome-animation__face-eye" />
                        <span className="welcome-animation__face-eye" />
                        <span className="welcome-animation__face-mouth" />
                      </div>
                    ) : step === 4 ? (
                      <div className="welcome-animation__location">
                        <span /><span /><span />
                        <FiMapPin size={58} aria-hidden="true" />
                      </div>
                    ) : issueMode && step === STEPS.length ? (
                      <div className="welcome-animation__issue-icon"><FiAlertCircle aria-hidden="true" /></div>
                    ) : step === 5 ? (
                      <div className="welcome-animation__complete"><FiCheck aria-hidden="true" /></div>
                    ) : (
                      <div className="welcome-animation__camera">
                        <span />
                        <ActiveIcon size={50} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <p className="welcome-animation__status">{activeStep?.status}</p>
                </div>
                <p className="welcome-animation__eyebrow">CHECK-IN PREVIEW · {step}/{STEPS.length}</p>
                <h2>{issueMode && step === STEPS.length ? "Check-in paused" : activeStep?.title}</h2>
                <p className="welcome-animation__description">
                  {issueMode && step === STEPS.length
                    ? issueMessage
                    : activeStep?.description}
                </p>
                <div className="welcome-animation__progress" aria-hidden="true">
                  <span style={{ width: `${(step / STEPS.length) * 100}%` }} />
                </div>
                <p className="welcome-animation__disclaimer">
                  Preview only. This animation does not access your camera, verify identity, or check location.
                </p>
                {!issueMode && step === STEPS.length && (
                  <button
                    className="welcome-animation__continue"
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      openAttendancePage();
                    }}
                  >
                    Open attendance page →
                  </button>
                )}
              </div>
              {(!issueMode || step < STEPS.length) && (
                <button
                  className="welcome-animation__skip"
                  type="button"
                  onClick={() => issueMode ? finishIssue() : setStep(STEPS.length)}
                >
                  {issueMode ? "Show error details" : "Skip preview"}
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
