"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** The site's own first-audit marks (Material, filled), copied from web-v2/components/FirstAudit.tsx on the live build. */
const MARK: Record<string, React.ReactNode> = {
  send: <g transform="translate(5 3.5)"><path d="M4 13H10V7H14L7 0L0 7H4V13ZM7 2.83L9.17 5H8V11H6V5H4.83L7 2.83ZM0 15H14V17H0V15Z" /></g>,
  breakdown: <g transform="translate(3 2)"><path d="M16.5 1.5L15 0L13.5 1.5L12 0L10.5 1.5L9 0L7.5 1.5L6 0L4.5 1.5L3 0V14H0V17C0 18.66 1.34 20 3 20H15C16.66 20 18 18.66 18 17V0L16.5 1.5ZM12 18H3C2.45 18 2 17.55 2 17V16H12V18ZM16 17C16 17.55 15.55 18 15 18C14.45 18 14 17.55 14 17V14H5V3H16V17Z" /><path d="M12 5H6V7H12V5Z" /><path d="M15 5H13V7H15V5Z" /><path d="M12 8H6V10H12V8Z" /><path d="M15 8H13V10H15V8Z" /></g>,
  decide: <g transform="translate(4 4)"><path d="M10 0L12.29 2.29L9.41 5.17L10.83 6.59L13.71 3.71L16 6V0H10ZM6 0H0V6L2.29 3.71L7 8.41V16H9V7.59L3.71 2.29L6 0Z" /></g>,
  sign: <g transform="translate(1.395 1)"><path d="M0 20H12V22H0V20ZM4.24 7.07L7.07 4.24L21.21 18.38L18.38 21.21L4.24 7.07ZM11.32 0L16.98 5.66L14.15 8.49L8.49 2.83L11.32 0ZM2.83 8.48L8.49 14.14L5.66 16.97L0 11.31L2.83 8.48Z" /></g>,
  file: <g transform="translate(1.5 3)"><path d="M2.01 3.03L9.52 6.25L2 5.25L2.01 3.03V3.03ZM9.51 11.75L2 14.97V12.75L9.51 11.75V11.75ZM0.01 0L0 7L15 9L0 11L0.01 18L21 9L0.01 0Z" /></g>,
  credit: <g transform="translate(2.5 2)"><path d="M4.5 9H2.5V16H4.5V9ZM10.5 9H8.5V16H10.5V9ZM19 18H0V20H19V18ZM16.5 9H14.5V16H16.5V9ZM9.5 2.26L14.71 5H4.29L9.5 2.26ZM9.5 0L0 5V7H19V5L9.5 0Z" /></g>,
  walk: <g transform="translate(3 3)"><path d="M7.09 12.59L8.5 14L13.5 9L8.5 4L7.09 5.41L9.67 8H0V10H9.67L7.09 12.59ZM16 0H2C0.89 0 0 0.9 0 2V6H2V2H16V16H2V12H0V16C0 17.1 0.89 18 2 18H16C17.1 18 18 17.1 18 16V2C18 0.9 17.1 0 16 0Z" /></g>,
};
const LABEL = {
  send: "Send your invoices",
  breakdown: "Get a full breakdown",
  decide: "You decide",
  sign: "Sign a power of attorney",
  walk: "You walk away",
  file: "We file the disputes",
  credit: "Carriers credit your account",
} as const;
type Node = keyof typeof LABEL;
type Branch = "sign" | "walk";
const OUTCOME: Record<Branch, string> = {
  sign: "Your carrier account is credited first. Our invoice, 35% of what was recovered, comes after.",
  walk: "The breakdown was free. Nothing signed, nothing owed.",
};
/** The site's beat (FirstAudit.module.css): a card opens, the wire leaving it draws, the next card opens. */
const BEAT_MS = 420;
const TRUNK = ["send", "t1", "breakdown", "t2", "decide"];
const FORK = ["fl", "fr", "sign", "walk"];
const SIGN_RUN = ["l1", "file", "l2", "credit"];
const DRAWN = new Set([...TRUNK, ...FORK]);

/** Board frame 04 · the first audit, working. Both branches are buttons drawn the same; the chosen one runs to its end
 *  and the other quiets. Before the script runs (or with reduced motion) it shows drawn: trunk and fork. */
export function FirstAudit() {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [armed, setArmed] = useState(false);
  const [on, setOn] = useState<Set<string>>(DRAWN);
  const [pulse, setPulse] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Branch | null>(null);
  const [ended, setEnded] = useState(false);

  const reduce = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const at = useCallback((ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const add = (k: string) => setOn((s) => new Set(s).add(k));
  const flash = useCallback((k: string, beat: number) => {
    if (!beat) return;
    setPulse((s) => new Set(s).add(k));
    at(beat * 2, () => setPulse((s) => { const n = new Set(s); n.delete(k); return n; }));
  }, [at]);
  const show = useCallback((keys: string[], t0: number, beat: number) => {
    keys.forEach((k, i) => at(t0 + i * beat, () => { add(k); if (k in LABEL) flash(k, beat); }));
  }, [at, flash]);

  // Offscreen at load: hide it, then draw it in when it's reached. On screen already (or reduced motion): stays drawn.
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce() || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setArmed(true);
    setOn(new Set());
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      show([...TRUNK], 0, BEAT_MS);
      at(TRUNK.length * BEAT_MS, () => setOn((s) => new Set([...s, ...FORK])));
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); clear(); };
  }, [at, show]);

  const choose = (b: Branch) => {
    if (choice) return;
    const beat = reduce() ? 0 : BEAT_MS;
    setChoice(b);
    setOn((s) => new Set([...s, ...DRAWN]));
    flash(b, beat);
    const run = b === "sign" ? SIGN_RUN : [];
    show(run, beat, beat);
    at(beat * (run.length + 1), () => setEnded(true));
  };
  const again = () => {
    clear();
    setChoice(null);
    setEnded(false);
    setPulse(new Set());
    setOn(new Set(DRAWN));
    first.current?.focus({ preventScroll: true });
  };

  const cls = (k: string, base: string) => {
    const rest = choice && ((choice === "sign" && (k === "walk" || k === "fr")) || (choice === "walk" && (k === "sign" || k === "fl")));
    const end = ended && ((choice === "sign" && k === "credit") || (choice === "walk" && k === "walk"));
    return [base, on.has(k) && "on", pulse.has(k) && "pulse", rest && "rest", end && "end"].filter(Boolean).join(" ");
  };
  const node = (k: Node) => (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{MARK[k]}</svg>
      {LABEL[k]}
    </>
  );
  const wire = (k: string, d: string) => <path className={cls(k, "w")} data-w={k} pathLength={1} d={d} />;

  return (
    <div ref={ref} className={choice ? "fa chosen" : "fa"} data-armed={armed ? "" : undefined} role="group" aria-label="Your first audit, working: choose a branch">
      <svg className="wires" viewBox="0 0 1296 530" preserveAspectRatio="none" aria-hidden="true">
        {wire("t1", "M648 60 L648 94")}
        {wire("t2", "M648 154 L648 188")}
        {wire("fl", "M438 218 C 400 218, 376 244, 376 282")}
        {wire("fr", "M858 218 C 896 218, 920 244, 920 282")}
        {wire("l1", "M376 342 L376 376")}
        {wire("l2", "M376 436 L376 470")}
      </svg>
      {(["send", "breakdown", "decide"] as const).map((k) => <div key={k} className={cls(k, "fa-node")} data-n={k}>{node(k)}</div>)}
      {(["sign", "walk"] as const).map((k, i) => (
        <button key={k} ref={i === 0 ? first : undefined} type="button" className={cls(k, "fa-node")} data-n={k} aria-pressed={choice === k} aria-disabled={!!choice && choice !== k} onClick={() => choose(k)}>
          {node(k)}
          <span className="choose" aria-hidden="true">Choose</span>
        </button>
      ))}
      {(["file", "credit"] as const).map((k) => <div key={k} className={cls(k, "fa-node")} data-n={k}>{node(k)}</div>)}
      <p className={ended ? "fa-out on" : "fa-out"} aria-live="polite">{ended && choice ? OUTCOME[choice] : ""}</p>
      {ended && <button type="button" className="fa-again on" onClick={again}>Choose again</button>}
    </div>
  );
}
