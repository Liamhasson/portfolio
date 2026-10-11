/* Pulse onboarding, clickable: the overlay shell around the coded app (onboarding-app.ts), which renders the 12
   onboarding frames of the Figma file (0W2igIjHC2Qx9qVBVA1lFX) as real HTML with every control the file has.
   The shell owns opening and closing, focus, the screen history (Back), the iOS push between screens and the
   misclick hint: a tap that hits no control shows where the controls are, as Figma's own prototype view does.
   Moved into the site from the board (docs/prototypes/pulse-mockups/onboarding-proto.js): types added, GSAP from npm,
   a mount function with the cleanup it returns; the open buttons it serves are the page's own. */
import { gsap } from "gsap";
import { createApp, type PublicChoices } from "./onboarding-app";

export interface PulseProtoState { open: boolean; screen: number; settled: boolean; hinting: boolean; choices: PublicChoices }
/** The test hook, as on the board: window.__pulseProto. */
const setHook = (v: { state(): PulseProtoState } | undefined) => {
  (window as unknown as { __pulseProto?: { state(): PulseProtoState } }).__pulseProto = v;
};

export function mountPulseProto(dialog: HTMLElement, scope: ParentNode = document): () => void {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screenEl = dialog.querySelector(".proto-screen") as HTMLElement;
  const appEl = dialog.querySelector("[data-pa]") as HTMLElement;
  const caps = [...dialog.querySelectorAll<HTMLElement>(".proto-cap")];
  const count = dialog.querySelector("[data-proto-count]") as HTMLElement;
  let screen = 1;
  let history: number[] = [];
  let settled = true;
  let hinting = false;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  let tl: gsap.core.Timeline | null = null;
  let opener: HTMLElement | null = null;
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Document, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn as EventListener);
    off.push(() => el.removeEventListener(type, fn as EventListener));
  };

  // The app is laid out in the frames' 393 × 852 units; one scale fits it to the phone at any size.
  const fit = () => { const w = screenEl.clientWidth; if (w) appEl.style.setProperty("--pa-s", String(w / 393)); };
  const ro = new ResizeObserver(fit);
  ro.observe(screenEl);
  off.push(() => ro.disconnect());

  const app = createApp(appEl, {
    reduce,
    navigate: (to) => { if (!settled || to === screen) return; history.push(screen); go(to, 1); },
    back: () => { if (!settled) return; const prev = history.pop(); if (prev) go(prev, -1); },
    busy: (b) => { settled = !b; },
    isSettled: () => settled,
  });
  const screens = app.screens;
  const shade = (el: HTMLElement) => el.querySelector(".pa-shade") as HTMLElement;

  const render = () => {
    caps.forEach((c, i) => c.classList.toggle("is-on", i === screen - 1));
    count.textContent = `${String(screen).padStart(2, "0")} / 12`;
  };
  /* Only the screen on show can be reached (by pointer, Tab or a screen reader). */
  const mark = (n: number) => screens.forEach((el, i) => { el.classList.toggle("is-current", i === n - 1); el.inert = i !== n - 1; });

  const go = (to: number, dir: number) => {
    if (tl) { tl.progress(1).kill(); tl = null; }
    clearHint();
    const from = screen;
    const hadFocus = dialog.querySelector(".pa")?.contains(document.activeElement);
    screen = to;
    render();
    mark(to);
    app.enter(to, from !== to);
    const out = screens[from - 1], inn = screens[to - 1];
    // Focus follows the screen, as VoiceOver moves to the top of a pushed view.
    if (hadFocus || document.activeElement === document.body) inn.focus({ preventScroll: true });
    if (reduce || from === to) {
      screens.forEach((el, i) => { gsap.set(el, { autoAlpha: i === to - 1 ? 1 : 0, xPercent: 0, zIndex: 0 }); gsap.set(shade(el), { opacity: 0 }); });
      settled = true;
      return;
    }
    settled = false;
    const done = () => {
      screens.forEach((el, i) => { if (i !== to - 1) gsap.set(el, { autoAlpha: 0, xPercent: 0 }); gsap.set(shade(el), { opacity: 0 }); });
      settled = true; tl = null;
    };
    // iOS push: the new screen slides in over the old one, which drifts back under a shade.
    tl = gsap.timeline({ onComplete: done });
    if (dir > 0) {
      gsap.set(inn, { zIndex: 2 }); gsap.set(out, { zIndex: 1 });
      tl.fromTo(inn, { autoAlpha: 1, xPercent: 100 }, { xPercent: 0, duration: 0.42, ease: "power3.out" }, 0)
        .to(out, { xPercent: -28, duration: 0.42, ease: "power3.out" }, 0)
        .to(shade(out), { opacity: 0.4, duration: 0.42, ease: "power3.out" }, 0);
    } else {
      gsap.set(inn, { zIndex: 1 }); gsap.set(out, { zIndex: 2 });
      tl.fromTo(inn, { autoAlpha: 1, xPercent: -28 }, { xPercent: 0, duration: 0.42, ease: "power3.out" }, 0)
        .fromTo(shade(inn), { opacity: 0.4 }, { opacity: 0, duration: 0.42, ease: "power3.out" }, 0)
        .to(out, { xPercent: 100, duration: 0.42, ease: "power3.out" }, 0);
    }
  };

  const clearHint = () => { clearTimeout(hintTimer); hinting = false; screenEl.classList.remove("is-hinting"); };
  // A tap that misses every live control (or lands on one that's unavailable) shows where the controls are, briefly.
  on(screenEl, "click", (e) => {
    const hit = (e.target as Element).closest(".pa-hit");
    if (hit && hit.getAttribute("aria-disabled") !== "true") return;
    clearHint();
    hinting = true;
    screenEl.classList.add("is-hinting");
    hintTimer = setTimeout(clearHint, 900);
  });

  const show = (n: number) => {
    if (tl) { tl.progress(1).kill(); tl = null; }
    screen = n;
    screens.forEach((el, i) => { gsap.set(el, { autoAlpha: i === n - 1 ? 1 : 0, xPercent: 0, zIndex: 0 }); gsap.set(shade(el), { opacity: 0 }); });
    mark(n);
    app.enter(n);
    render();
    settled = true;
  };
  const restart = () => {
    app.reset();
    history = [];
    if (screen === 1) return;
    go(1, -1);
  };
  // checkVisibility is Safari 17.4+; older browsers get the same test by hand
  const visible = (el: HTMLElement) => typeof el.checkVisibility === "function"
    ? el.checkVisibility({ visibilityProperty: true })
    : el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const focusables = () => [...dialog.querySelectorAll<HTMLElement>("button, [href], [tabindex]")]
    .filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && !el.closest("[inert]") && visible(el));

  const open = (from: HTMLElement) => {
    opener = from;
    history = [];
    app.reset();
    dialog.hidden = false;
    fit();
    show(1);
    document.documentElement.style.overflow = "hidden"; // the page and its scroll story hold still
    if (!reduce) gsap.fromTo(dialog.querySelector(".proto-body"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" }); // opacity only: focus can land at once
    ((screens[0].querySelector(".pa-hit") || dialog.querySelector("[data-proto-close]")) as HTMLElement).focus();
  };
  const close = () => {
    clearHint();
    dialog.hidden = true;
    document.documentElement.style.overflow = "";
    opener?.focus();
  };

  on(dialog.querySelector("[data-proto-close]") as HTMLElement, "click", close);
  on(dialog.querySelector("[data-proto-restart]") as HTMLElement, "click", restart);
  on(dialog.querySelector(".proto-backdrop") as HTMLElement, "click", close);
  // On the document, not the dialog: a click on the overlay's plain text moves focus to <body>, and Escape and Tab
  // must still work while the dialog is open.
  on(document, "keydown", (e) => {
    if (dialog.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    const j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
    e.preventDefault();
    f[j].focus();
  });
  // Every "Tap through it yourself" on the page opens the same prototype.
  on(document, "click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-proto-open]");
    if (b && (scope === document || (scope as Node).contains(b))) open(b);
  });

  setHook({ state: () => ({ open: !dialog.hidden, screen, settled, hinting, choices: app.choices() }) });

  return () => {
    off.forEach((f) => f());
    clearTimeout(hintTimer);
    tl?.kill();
    if (!dialog.hidden) { dialog.hidden = true; document.documentElement.style.overflow = ""; }
    setHook(undefined);
  };
}
