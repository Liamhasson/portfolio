/* Pulse onboarding, clickable: the 12 frames exported from Figma (file 0W2igIjHC2Qx9qVBVA1lFX,
   frames 01_Welcome … 12_NotificationsConfirmed), with hotspots on the controls each frame really
   has, positioned from the Figma layers (393 × 852). Nothing invented: a tap on a dead spot only
   shows where the live controls are, as Figma's own prototype view does. */

const { gsap } = window;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = 393, H = 852;
const BACK = { label: "Back", x: 24, y: 58, w: 44, h: 44, to: "back" };
const SKIP = { label: "Skip", x: 312, y: 60, w: 57, h: 38 };
const CTA = { x: 24, y: 716, w: 345, h: 56 };

/** Hotspots per screen (1-based screen numbers), from the Figma frames' layers. */
const HOTSPOTS = {
  1: [{ label: "Get started", x: 24, y: 700, w: 345, h: 56, to: 2 }],
  2: [BACK, { ...SKIP, to: 3 }, { ...CTA, label: "Continue", to: 3 }],
  3: [BACK, { ...SKIP, to: 4 }, { ...CTA, label: "Continue", to: 4 }],
  4: [BACK, { label: "Continue", x: 24, y: 672, w: 345, h: 56, to: 5 }, { label: "Skip for now", x: 24, y: 744, w: 345, h: 52, to: 10 }],
  5: [BACK, { ...CTA, label: "Continue", to: 6 }],
  6: [BACK, ...["Burn Club", "Iron Yard", "Sweat Lab", "Studio 9"].map((label, k) => ({ label, x: 24, y: 232 + k * 106, w: 345, h: 90, to: 7 }))],
  // Only slots that can be booked: the first three are fully booked.
  7: [BACK, ...[["Maya Thompson, 11:00, 1 spot left", 3], ["Leon Smith, 12:00, available", 4], ["Mark Anderson, 13:00, available", 5]].map(([label, k]) => ({ label, x: 24, y: 280 + k * 92, w: 345, h: 76, to: 8 }))],
  8: [BACK, { ...CTA, label: "Book now", to: 9, slide: true }],
  9: [{ ...CTA, label: "Done", to: 10 }],
  10: [BACK, { ...CTA, label: "Continue", to: 11 }],
  11: [{ label: "Enable notifications", x: 24, y: 648, w: 345, h: 56, to: 12 }, { ...CTA, label: "Maybe later", to: 12 }],
  12: [],
};
const pct = (v, of) => `${(v / of) * 100}%`;

function mount() {
  const dialog = document.querySelector("[data-proto]");
  const screens = [...dialog.querySelectorAll(".proto-shot")];
  const layer = dialog.querySelector(".proto-hots");
  const screenEl = dialog.querySelector(".proto-screen");
  const caps = [...dialog.querySelectorAll(".proto-cap")];
  const count = dialog.querySelector("[data-proto-count]");
  const knob = dialog.querySelector(".proto-knob");
  let screen = 1;
  let history = [];
  let settled = true;
  let hinting = false;
  let hintTimer = 0;
  let tl = null;
  let opener = null;

  const render = () => {
    layer.replaceChildren(...HOTSPOTS[screen].map((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hot";
      b.setAttribute("aria-label", h.label);
      Object.assign(b.style, { left: pct(h.x, W), top: pct(h.y, H), width: pct(h.w, W), height: pct(h.h, H) });
      b.addEventListener("click", (e) => { e.stopPropagation(); press(h); });
      return b;
    }));
    caps.forEach((c, i) => c.classList.toggle("is-on", i === screen - 1));
    count.textContent = `${String(screen).padStart(2, "0")} / 12`;
  };

  const go = (to, dir) => {
    if (tl) { tl.progress(1).kill(); tl = null; }
    const from = screen;
    screen = to;
    render();
    const out = screens[from - 1], inn = screens[to - 1];
    if (reduce || from === to) {
      screens.forEach((s, i) => gsap.set(s, { autoAlpha: i === to - 1 ? 1 : 0, xPercent: 0 }));
      settled = true;
      return;
    }
    settled = false;
    // iOS push: the new screen slides in over the old one, which drifts back and dims.
    gsap.set(inn, { zIndex: 2 }); gsap.set(out, { zIndex: 1 });
    tl = gsap.timeline({ onComplete: () => { screens.forEach((s, i) => { if (i !== to - 1) gsap.set(s, { autoAlpha: 0, xPercent: 0, filter: "none" }); }); settled = true; tl = null; } });
    if (dir > 0) {
      tl.fromTo(inn, { autoAlpha: 1, xPercent: 100 }, { xPercent: 0, duration: 0.42, ease: "power3.out" }, 0)
        .to(out, { xPercent: -28, filter: "brightness(.6)", duration: 0.42, ease: "power3.out" }, 0);
    } else {
      gsap.set(inn, { zIndex: 1 }); gsap.set(out, { zIndex: 2 });
      tl.fromTo(inn, { autoAlpha: 1, xPercent: -28, filter: "brightness(.6)" }, { xPercent: 0, filter: "brightness(1)", duration: 0.42, ease: "power3.out" }, 0)
        .to(out, { xPercent: 100, duration: 0.42, ease: "power3.out" }, 0);
    }
  };

  const press = (h) => {
    if (!settled) return;
    clearHint();
    if (h.to === "back") {
      const prev = history.pop();
      if (prev) go(prev, -1);
      return;
    }
    const next = () => { history.push(screen); go(h.to, 1); };
    if (h.slide && !reduce) {
      // The slide-to-book control: the knob travels to the end, then the booking goes through.
      settled = false;
      gsap.fromTo(knob, { autoAlpha: 1, x: 0 }, { x: () => knob.parentElement.clientWidth - knob.offsetWidth, duration: 0.45, ease: "power2.inOut",
        onComplete: () => { gsap.set(knob, { autoAlpha: 0, x: 0 }); settled = true; next(); } });
    } else next();
  };

  const clearHint = () => { clearTimeout(hintTimer); hinting = false; screenEl.classList.remove("is-hinting"); };
  // A tap that misses every control shows where the controls are, briefly.
  screenEl.addEventListener("click", (e) => {
    if (e.target.closest(".hot")) return;
    clearHint();
    hinting = true;
    screenEl.classList.add("is-hinting");
    hintTimer = setTimeout(clearHint, 900);
  });

  const restart = () => { history = []; go(1, -1); };
  const focusables = () => [...dialog.querySelectorAll("button:not([hidden])")].filter((b) => b.offsetParent !== null);

  const open = (from) => {
    opener = from;
    history = [];
    screen = 1;
    screens.forEach((s, i) => gsap.set(s, { autoAlpha: i === 0 ? 1 : 0, xPercent: 0, filter: "none", zIndex: 0 }));
    render();
    dialog.hidden = false;
    document.documentElement.style.overflow = "hidden"; // the page and its scroll story hold still
    if (!reduce) gsap.fromTo(dialog.querySelector(".proto-body"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" }); // opacity only: focus can land at once
    (layer.querySelector(".hot") || dialog.querySelector("[data-proto-close]")).focus();
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

  window.__pulseProto = { state: () => ({ open: !dialog.hidden, screen, settled, hinting }) };
}

mount();
