/* Pulse onboarding, clickable: the overlay shell around the coded app (onboarding-app.js), which renders the 12
   onboarding frames of the Figma file (0W2igIjHC2Qx9qVBVA1lFX) as real HTML with every control the file has.
   The shell owns opening and closing, focus, the screen history (Back), the iOS push between screens and the
   misclick hint: a tap that hits no control shows where the controls are, as Figma's own prototype view does. */

import { createApp } from "./onboarding-app.js";

const { gsap } = window;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function mount() {
  const dialog = document.querySelector("[data-proto]");
  const screenEl = dialog.querySelector(".proto-screen");
  const appEl = dialog.querySelector("[data-pa]");
  const caps = [...dialog.querySelectorAll(".proto-cap")];
  const count = dialog.querySelector("[data-proto-count]");
  let screen = 1;
  let history = [];
  let settled = true;
  let hinting = false;
  let hintTimer = 0;
  let tl = null;
  let opener = null;

  // The app is laid out in the frames' 393 × 852 units; one scale fits it to the phone at any size.
  const fit = () => { const w = screenEl.clientWidth; if (w) appEl.style.setProperty("--pa-s", String(w / 393)); };
  new ResizeObserver(fit).observe(screenEl);

  const app = createApp(appEl, {
    gsap, reduce,
    navigate: (to) => { if (!settled || to === screen) return; history.push(screen); go(to, 1); },
    back: () => { if (!settled) return; const prev = history.pop(); if (prev) go(prev, -1); },
    busy: (on) => { settled = !on; },
    isSettled: () => settled,
  });
  const screens = app.screens;
  const shade = (el) => el.querySelector(".pa-shade");

  const render = () => {
    caps.forEach((c, i) => c.classList.toggle("is-on", i === screen - 1));
    count.textContent = `${String(screen).padStart(2, "0")} / 12`;
  };
  /* Only the screen on show can be reached (by pointer, Tab or a screen reader). */
  const mark = (on) => screens.forEach((el, i) => { el.classList.toggle("is-current", i === on - 1); el.inert = i !== on - 1; });

  const go = (to, dir) => {
    if (tl) { tl.progress(1).kill(); tl = null; }
    clearHint();
    const from = screen;
    const hadFocus = dialog.querySelector(".pa")?.contains(document.activeElement);
    screen = to;
    render();
    mark(to);
    app.enter(to);
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
  screenEl.addEventListener("click", (e) => {
    const hit = e.target.closest(".pa-hit");
    if (hit && hit.getAttribute("aria-disabled") !== "true") return;
    clearHint();
    hinting = true;
    screenEl.classList.add("is-hinting");
    hintTimer = setTimeout(clearHint, 900);
  });

  const show = (n) => {
    if (tl) { tl.progress(1).kill(); tl = null; }
    screen = n;
    screens.forEach((el, i) => { gsap.set(el, { autoAlpha: i === n - 1 ? 1 : 0, xPercent: 0, zIndex: 0 }); gsap.set(shade(el), { opacity: 0 }); });
    mark(n);
    render();
    settled = true;
  };
  const restart = () => {
    app.reset();
    history = [];
    if (screen === 1) return;
    go(1, -1);
  };
  const focusables = () => [...dialog.querySelectorAll("button, [href], [tabindex]")]
    .filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest("[inert]") && el.checkVisibility({ visibilityProperty: true }));

  const open = (from) => {
    opener = from;
    history = [];
    app.reset();
    dialog.hidden = false;
    fit();
    show(1);
    document.documentElement.style.overflow = "hidden"; // the page and its scroll story hold still
    if (!reduce) gsap.fromTo(dialog.querySelector(".proto-body"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" }); // opacity only: focus can land at once
    (screens[0].querySelector(".pa-hit") || dialog.querySelector("[data-proto-close]")).focus();
  };
  const close = () => {
    clearHint();
    dialog.hidden = true;
    document.documentElement.style.overflow = "";
    opener?.focus();
  };

  dialog.querySelector("[data-proto-close]").addEventListener("click", close);
  dialog.querySelector("[data-proto-restart]").addEventListener("click", restart);
  dialog.querySelector(".proto-backdrop").addEventListener("click", close);
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    const j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
    e.preventDefault();
    f[j].focus();
  });
  // Every story (desktop, phone, still grid) carries the same button; one prototype serves them all.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-proto-open]");
    if (b) open(b);
  });

  window.__pulseProto = { state: () => ({ open: !dialog.hidden, screen, settled, hinting, choices: app.choices() }) };
}

mount();
