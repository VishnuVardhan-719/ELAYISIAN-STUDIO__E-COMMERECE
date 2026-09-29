import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import styles from "./Entrance.module.css";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export default function Entrance() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(() => pathname === "/");
  const [celebrate, setCelebrate] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const target = useRef(0);
  const finish = useRef<(skip?: boolean) => void>(() => {});

  useEffect(() => {
    if (!visible) return;
    const content = document.getElementById("studio-content");
    content?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0, current = 0, touchY = 0, done = false;
    let startedAt: number | null = null;
    const duration = 6200;
    let effectsStarted = false;
    target.current = 0;
    const restore = () => {
      document.body.style.overflow = previousOverflow;
      content?.removeAttribute("inert");
    };
    finish.current = (skip = false) => {
      if (done) return;
      done = true;
      restore();
      setVisible(false);
      if (skip) setCelebrate(false);
      const main = document.getElementById("main");
      main?.setAttribute("tabindex", "-1");
      main?.focus({ preventScroll: true });
    };
    const advance = (delta: number) => {
      if (delta > 0) target.current = 1;
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      advance(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1));
    };
    const start = (event: TouchEvent) => { touchY = event.touches[0].clientY; };
    const move = (event: TouchEvent) => {
      event.preventDefault();
      const y = event.touches[0].clientY;
      advance((touchY - y) * 2.4);
      touchY = y;
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish.current(true);
      else if (["ArrowDown", "PageDown", " "].includes(event.key) && event.target === document.body) {
        event.preventDefault(); advance(240);
      }
    };
    const tick = (now: number) => {
      if (target.current > 0 && startedAt === null) startedAt = now;
      const elapsed = startedAt === null ? 0 : clamp((now - startedAt) / duration);
      current = elapsed * elapsed * (3 - 2 * elapsed);
      root.current?.style.setProperty("--open", String(current));
      if (elapsed >= 0.27 && !effectsStarted) {
        effectsStarted = true;
        setCelebrate(true);
      }
      if (elapsed >= 1) { finish.current(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame); restore();
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("keydown", key);
    };
  }, [visible]);

  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 8500);
    return () => clearTimeout(timer);
  }, [celebrate]);

  if (!visible && !celebrate) return null;
  return <>
    {visible && <div ref={root} className={styles.entrance} role="dialog" aria-modal="true" aria-label="Enter Elysian Studio">
      <div className={styles.veil} aria-hidden="true" />
      <div className={`${styles.door} ${styles.left}`} aria-hidden="true" />
      <div className={`${styles.door} ${styles.right}`} aria-hidden="true" />
      <div className={styles.radiance} aria-hidden="true" />
      <div className={styles.hint}>
        <span aria-hidden="true">↓</span>
        <button onClick={() => target.current = 1}>Scroll to open</button>
      </div>
      <button className={styles.skip} onClick={() => finish.current(true)}>Skip intro</button>
    </div>}
    {celebrate && <div className={styles.celebration} aria-hidden="true"><Garden /><div className={styles.flight}>
      {Array.from({ length: 6 }, (_, i) => <span className={styles.butterfly} key={i} style={{ "--i": i } as CSSProperties}><Butterfly index={i} /></span>)}
    </div></div>}
  </>;
}

function Garden() {
  return <div className={styles.garden} aria-hidden="true">{[0, 1].map(i => <div className={styles.flower} key={i} style={{ "--i": i } as CSSProperties}><img className={styles.blossom} src="/images/entrance-botanicals.webp" alt="" width="640" height="960" /></div>)}</div>;
}

function Butterfly({ index }: { index: number }) {
  return <svg viewBox="0 0 100 90" fill="none" aria-hidden="true">
    <defs><linearGradient id={`wing-${index}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3d5" /><stop offset=".55" stopColor={index % 2 ? "#ceae7c" : "#d5b4a3"} /><stop offset="1" stopColor="#72523d" /></linearGradient></defs>
    {[false, true].map(right => <g key={String(right)} transform={right ? 'translate(100 0) scale(-1 1)' : undefined}><g className={styles.wing}>
      <path d="M49 43C35 17 13 0 5 12C-3 27 8 49 38 48C12 45 8 61 19 73C30 87 43 65 49 48Z" fill={`url(#wing-${index})`} stroke="#6d523d" strokeWidth="1.2" />
      <path d="M48 44L12 16M47 44L9 30M47 45L17 41M46 49L20 65M46 49L31 71" stroke="#6e533d" strokeWidth=".6" opacity=".6" />
      <path d="M12 15L20 20M9 26L17 31M15 38L22 40M20 59L26 62M28 69L32 64" stroke="#fff3d4" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="22" cy="29" rx="5" ry="7" fill="#65513f" opacity=".35" />
    </g></g>)}
    <path d="M49 33Q41 17 39 23M51 33Q59 17 61 23" stroke="#544839" strokeWidth="1" />
    <ellipse cx="50" cy="45" rx="2.5" ry="18" fill="#65513e" /><circle cx="50" cy="29" r="3" fill="#65513e" />
  </svg>;
}
