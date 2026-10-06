import { useEffect, useRef } from "react";

const BRAND_COLORS = [
  { red: 105, green: 0, blue: 0, hex: "#690000" },
  { red: 125, green: 10, blue: 10, hex: "#7d0a0a" },
  { red: 212, green: 160, blue: 23, hex: "#d4a017" },
  { red: 255, green: 220, blue: 128, hex: "#ffdc80" },
];
const ATTENDANCE_COLORS = [
  { red: 37, green: 99, blue: 235, hex: "#2563eb" },
  { red: 14, green: 165, blue: 233, hex: "#0ea5e9" },
  { red: 125, green: 211, blue: 252, hex: "#7dd3fc" },
  { red: 219, green: 234, blue: 254, hex: "#dbeafe" },
];
const ORBIT_DURATION = 2000;
let animationStartedAt = 0;
let navigationTimeout = 0;

export function afterButtonAnimation(action) {
  const canvas = document.querySelector(".button-animation-canvas");
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !canvas?.dataset.animating
  ) {
    action();
    return;
  }
  window.clearTimeout(navigationTimeout);
  const navigationDelay = Math.max(
    0,
    animationStartedAt + ORBIT_DURATION * 0.2 - performance.now(),
  );
  navigationTimeout = window.setTimeout(action, navigationDelay);
}

function parseRgb(color) {
  const values = color.match(/[\d.]+/g)?.map(Number);
  if (!values || values.length < 3) return null;
  return { red: values[0], green: values[1], blue: values[2] };
}

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function getButtonPalette(button) {
  const styles = window.getComputedStyle(button);
  const background = parseRgb(styles.backgroundColor);
  const alphaMatch = styles.backgroundColor.match(
    /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/,
  );
  const backgroundAlpha = alphaMatch ? Number(alphaMatch[1]) : 1;
  const getLuminance = (color) =>
    color
      ? (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255
      : 1;
  const textColor = parseRgb(styles.color);
  const borderColor = parseRgb(styles.borderColor);
  const accent =
    background && backgroundAlpha > 0.05 && getLuminance(background) <= 0.72
      ? background
      : backgroundAlpha <= 0.05
        ? textColor || BRAND_COLORS[0]
        : borderColor && getLuminance(borderColor) <= 0.72
          ? borderColor
          : BRAND_COLORS[0];
  const toHex = ({ red, green, blue }) =>
    `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

  return [
    { ...accent, hex: toHex(accent) },
    ...BRAND_COLORS.slice(2),
    BRAND_COLORS[0],
  ];
}

export default function ButtonAnimation() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bubbles = [];
    const stars = [];
    const halos = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const spawn = (event) => {
      if (motionQuery.matches) return;
      const button = event.target.closest("button[data-button-animation]");
      if (!button || button.disabled) return;
      const form = button.closest("form.auth-form");
      if (form && !form.checkValidity()) return;
      canvas.dataset.animating = "true";

      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const now = performance.now();
      animationStartedAt = now;
      const viewportScale = Math.max(
        0.52,
        Math.min(1, Math.min(width, height) / 760),
      );
      const bubblesOnly = button.dataset.animationStyle === "bubbles";
      const palette = bubblesOnly
        ? ATTENDANCE_COLORS
        : getButtonPalette(button);
      if (bubblesOnly) {
        stars.length = 0;
        halos.length = 0;
      }

      const bubbleCount = bubblesOnly
        ? viewportScale < 0.75
          ? 24
          : 32
        : viewportScale < 0.75
          ? 12
          : 18;
      const bubbleColumns = bubblesOnly ? (viewportScale < 0.75 ? 6 : 8) : 1;
      const bubbleRows = Math.ceil(bubbleCount / bubbleColumns);
      for (let i = 0; i < bubbleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.5 + Math.random() * 2.5) * viewportScale;
        const duration = 1750 + Math.random() * 250;
        const column = i % bubbleColumns;
        const row = Math.floor(i / bubbleColumns);
        const spreadX = rect.width * 0.84;
        const spreadY = rect.height * 0.8;
        const startX = bubblesOnly
          ? rect.left +
            rect.width * 0.08 +
            ((column + Math.random() * 0.7 + 0.15) / bubbleColumns) * spreadX
          : x;
        const startY = bubblesOnly
          ? rect.top +
            rect.height * 0.1 +
            ((row + Math.random() * 0.7 + 0.15) / bubbleRows) * spreadY
          : y;
        const burstAngle = Math.atan2(startY - y, startX - x);
        const driftAngle = burstAngle + (Math.random() - 0.5) * 1.1;
        const driftSpeed = (3 + Math.random() * 3) * Math.max(viewportScale, 0.8);
        bubbles.push({
          x: startX,
          y: startY,
          vx: bubblesOnly
            ? Math.cos(driftAngle) * driftSpeed
            : Math.cos(angle) * speed,
          vy: bubblesOnly
            ? Math.sin(driftAngle) * driftSpeed - 0.8
            : Math.sin(angle) * speed - viewportScale,
          radius: bubblesOnly
            ? Math.min(rect.height * 0.18, (8 + Math.random() * 7) * viewportScale)
            : (6 + Math.random() * 8) * viewportScale,
          gravity: bubblesOnly ? 0.004 : 0.035,
          color: palette[Math.floor(Math.random() * palette.length)],
          born: now,
          duration,
        });
      }

      if (!bubblesOnly) {
        const orbitRadius = Math.min(
          Math.max(rect.width / 2 + 16 * viewportScale, 70 * viewportScale),
          128 * viewportScale,
        );
        const perRing = viewportScale < 0.75 ? [5, 4, 3] : [7, 6, 5];
        perRing.forEach((count, ring) => {
          for (let i = 0; i < count; i++) {
            stars.push({
              x,
              y,
              radius: orbitRadius * [0.72, 0.96, 1.2][ring],
              tilt: [1.05, -0.7, 0.35][ring],
              rotation: [0, 0.9, -0.8][ring],
              direction: ring === 1 ? -1 : 1,
              speed: [2.6, 2.1, 1.6][ring],
              angle: (i / count) * Math.PI * 2 + ring * 0.4,
              color: palette[(i + ring * 2) % palette.length].hex,
              size: (7 + Math.random() * 4) * viewportScale,
              spin: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2),
              born: now,
            });
          }
        });
        halos.push({ x, y, radius: orbitRadius * 0.72, born: now, palette });
        halos.push({ x, y, radius: orbitRadius * 0.58, born: now + 140, palette });
      }
      if (!frameId) frameId = requestAnimationFrame(animate);
    };

    const drawStar = (x, y, radius, rotation, color, alpha) => {
      context.save();
      context.globalAlpha = alpha;
      context.translate(x, y);
      context.rotate(rotation);
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.45;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.restore();
    };

    const getStarPosition = (star, age) => {
      const progress = age / ORBIT_DURATION;
      const angle = star.angle + star.direction * star.speed * (age / 1000);
      const radius = star.radius * (0.2 + 0.8 * Math.min(1, progress / 0.22));
      const orbitX = Math.cos(angle) * radius;
      const orbitY = Math.sin(angle) * radius * Math.cos(star.tilt);
      const depth = Math.sin(angle) * radius * Math.sin(star.tilt);
      const scale = 500 / (500 - depth);
      return {
        x: star.x + (orbitX * Math.cos(star.rotation) - orbitY * Math.sin(star.rotation)) * scale,
        y: star.y + (orbitX * Math.sin(star.rotation) + orbitY * Math.cos(star.rotation)) * scale,
        scale,
      };
    };

    function animate(now) {
      frameId = 0;
      context.clearRect(0, 0, width, height);

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        const age = now - bubble.born;
        if (age >= bubble.duration) {
          bubbles.splice(i, 1);
          continue;
        }
        const progress = age / bubble.duration;
        const seconds = (age / 16) * (900 / bubble.duration);
        const x = bubble.x + bubble.vx * seconds;
        const y = bubble.y + bubble.vy * seconds - seconds * seconds * bubble.gravity;
        const radius = bubble.radius * (1 + progress * 0.5);
        const gradient = context.createRadialGradient(
          x - radius * 0.3,
          y - radius * 0.3,
          radius * 0.1,
          x,
          y,
          radius,
        );
        const { red, green, blue } = bubble.color;
        gradient.addColorStop(0, "rgba(255, 248, 225, 0.85)");
        gradient.addColorStop(0.5, `rgba(${red}, ${green}, ${blue}, 0.35)`);
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0.12)`);
        context.save();
        context.globalAlpha = 1 - progress;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.8)`;
        context.stroke();
        context.beginPath();
        context.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,0.85)";
        context.fill();
        context.restore();
      }

      for (let i = halos.length - 1; i >= 0; i--) {
        const halo = halos[i];
        const progress = (now - halo.born) / 1000;
        if (progress < 0) continue;
        if (progress >= 1) {
          halos.splice(i, 1);
          continue;
        }
        const radius = halo.radius * (0.8 + progress * 0.8);
        const gradient = context.createLinearGradient(
          halo.x - radius,
          halo.y,
          halo.x + radius,
          halo.y,
        );
        halo.palette.forEach((color, index) => {
          gradient.addColorStop(index / (halo.palette.length - 1), color.hex);
        });
        context.beginPath();
        context.arc(halo.x, halo.y, radius, 0, Math.PI * 2);
        context.globalAlpha = (1 - progress) * 0.8;
        context.lineWidth = 4 * (1 - progress) + 1;
        context.strokeStyle = gradient;
        context.stroke();
        context.globalAlpha = 1;
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        const age = now - star.born;
        if (age >= ORBIT_DURATION) {
          stars.splice(i, 1);
          continue;
        }
        const progress = age / ORBIT_DURATION;
        const current = getStarPosition(star, age);
        const trailDuration = 240;
        const previous = getStarPosition(star, Math.max(0, age - trailDuration));
        const fade = Math.min(1, age / 320) * (1 - Math.max(0, (progress - 0.8) / 0.2));
        const ray = context.createLinearGradient(previous.x, previous.y, current.x, current.y);
        ray.addColorStop(0, hexToRgba(star.color, 0));
        ray.addColorStop(0.65, hexToRgba(star.color, 0.38));
        ray.addColorStop(1, hexToRgba(star.color, 0.85));
        context.save();
        context.globalAlpha = fade;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(current.x, current.y);
        context.lineWidth = Math.max(2, star.size * current.scale * 0.42);
        context.lineCap = "round";
        context.strokeStyle = ray;
        context.shadowColor = star.color;
        context.shadowBlur = 10;
        context.stroke();
        for (let step = 1; step <= 3; step++) {
          const tail = getStarPosition(star, Math.max(0, age - step * (trailDuration / 4)));
          const tailFade = fade * (1 - step / 4) * 0.7;
          context.globalAlpha = tailFade;
          context.beginPath();
          context.arc(tail.x, tail.y, Math.max(1, star.size * tail.scale * 0.16), 0, Math.PI * 2);
          context.fillStyle = star.color;
          context.shadowBlur = 7;
          context.fill();
        }
        context.restore();
        drawStar(
          current.x,
          current.y,
          star.size * current.scale,
          age / 1000 * star.spin,
          star.color,
          fade,
        );
      }

      if (bubbles.length || stars.length || halos.length) {
        frameId = requestAnimationFrame(animate);
      } else {
        context.clearRect(0, 0, width, height);
        canvas.dataset.animating = "false";
      }
    }

    resize();
    document.addEventListener("click", spawn, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("click", spawn, true);
      window.removeEventListener("resize", resize);
      if (frameId) cancelAnimationFrame(frameId);
      window.clearTimeout(navigationTimeout);
    };
  }, []);

  return <canvas ref={canvasRef} className="button-animation-canvas" aria-hidden="true" />;
}
