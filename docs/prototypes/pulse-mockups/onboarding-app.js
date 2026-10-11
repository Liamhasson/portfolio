/* Pulse onboarding, coded from the Figma file (0W2igIjHC2Qx9qVBVA1lFX, frames 01_Welcome … 12_NotificationsConfirmed).
   The 12 screens as real HTML in the frames' own 393 × 852 units (styles: onboarding-app.css), every control the file
   has made to work, and the choices carried from screen to screen. The overlay shell (open, close, history, the push
   transition) lives in onboarding-proto.js and drives this through createApp(). */

const A = (f) => new URL(`./app/${f}`, import.meta.url).href;

/* ------------------------------ content (the Figma text, verbatim) ------------------------------ */
const GOALS = ["Get stronger", "Stay active", "Feel more energized", "Become more flexible", "Lose weight"];
/* Strength & Conditioning is the file's own open card. Cardio's chips are the file's Cardio list
   (02_ActivitiesCategoriesCardio) less Boxing, already under Strength here, and Dance, which has its own category.
   Mind & Body: Yoga is the file's; Pilates and Mobility are added. Dance & Movement: Dance is the file's; Zumba and
   Barre are added. The file has no subtitle for the three collapsed categories, so they open without one. */
const CATS = [
  { name: "Strength & Conditioning", sub: "High-intensity & functional training", chips: ["HIIT", "Hyrox", "Weight Lifting", "Bodyweight", "Boxing"] },
  { name: "Cardio & Endurance", chips: ["Spinning", "Swimming", "Running", "Rowing"] },
  { name: "Mind & Body", chips: ["Yoga", "Pilates", "Mobility"] },
  { name: "Dance & Movement", chips: ["Dance", "Zumba", "Barre"] },
];
const WORKOUTS = [
  ["HIIT", "workout-hiit.jpg"], ["Hyrox", "workout-hyrox.jpg"], ["Crossfit", "workout-crossfit.jpg"],
  ["Open Gym", "workout-opengym.jpg"], ["Calisthenic", "workout-calisthenic.jpg"], ["Weight Lifting", "workout-weightlifting.jpg"],
];
const STUDIOS = [
  ["Burn Club", "Danziger · 1.5 km", "4.9 rating", "studio-burnclub.jpg"],
  ["Iron Yard", "Kreuzberg · 2.1 km", "4.8 rating", "studio-ironyard.jpg"],
  ["Sweat Lab", "Mitte · 3.4 km", "4.7 rating", "studio-sweatlab.jpg"],
  ["Studio 9", "Prenzlauer · 4.0 km", "4.9 rating", "studio-studio9.jpg"],
];
/* Mon 1st is Mon, Dec 1 (08_BookingConfirmation); the other chips follow the same calendar. */
const DAYS = [
  { d: "Today", date: "Sun, Nov 30" },
  { d: "Mon", n: "1st", date: "Mon, Dec 1" },
  { d: "Tue", n: "2nd", date: "Tue, Dec 2" },
  { d: "Wed", n: "3rd", date: "Wed, Dec 3" },
  { d: "Thu", n: "4th", date: "Thu, Dec 4" },
];
const SLOTS = [
  ["Mark Adams", "08:00–08:45", "full"], ["Tory Green", "09:00–09:45", "full"], ["Elena Rodriguez", "10:00–10:45", "full"],
  ["Maya Thompson", "11:00–11:45", "spots"], ["Leon Smith", "12:00–12:45", "open"], ["Mark Anderson", "13:00–13:45", "open"],
  ["Mark Anderson", "14:00–14:45", "open"],
];
const BADGE = { full: "Fully booked", spots: "1 spots left", open: "Available" };

const INITIAL = () => ({
  goals: ["Get stronger", "Stay active"], activities: ["HIIT", "Hyrox"], open: 0,
  workout: null, studio: null, day: "Mon, Dec 1", slot: null,
});

/* ------------------------------ markup ------------------------------ */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img = (f, cls = "") => `<img src="${A(f)}" alt=""${cls ? ` class="${cls}"` : ""} loading="lazy" decoding="async" draggable="false">`;
const status = (solid) => `<div aria-hidden="true"><span class="pa-time">9:41</span><span class="pa-batt${solid ? " is-solid" : ""}"></span></div>`;
const home = (cls = "") => `<div class="pa-home ${cls}" aria-hidden="true"></div>`;
const back = `<button type="button" class="pa-back pa-glass pa-hit" data-act="back" aria-label="Back">${img("ic-back.svg")}</button>`;
const skip = (to) => `<button type="button" class="pa-skip pa-hit" data-act="go" data-to="${to}">Skip</button>`;
const progress = (w) => `<div class="pa-progress" aria-hidden="true"><i style="width:${w}px"></i></div>`;
const cta = (label, to, { top = 716, glow = false, act = "go", extra = "" } = {}) =>
  `<button type="button" class="pa-cta pa-hit${glow ? " is-glow" : ""}" style="top:${top}px" data-act="${act}"${to ? ` data-to="${to}"` : ""}${extra}>${label}</button>`;
const head = (title, sub, top = 128, bind = "") =>
  `<div class="pa-head" style="top:${top}px"><h2 class="pa-display">${title}</h2><p class="pa-body"${bind ? ` data-bind="${bind}"` : ""}>${sub}</p></div>`;
const bg = (n) => `<div class="pa-bg" aria-hidden="true">${img(`bg-${n}.svg`)}</div>`;
const glow = (f = "glow.svg") => `<div aria-hidden="true">${img(f, "pa-glow")}</div>`;
const screen = (n, label, inner) =>
  `<section class="pa-screen" data-screen="${n}" aria-label="${esc(label)}" tabindex="-1">${inner}<div class="pa-shade" aria-hidden="true"></div></section>`;

const SCREENS = [
  // 01_Welcome
  screen(1, "Welcome", `${bg(1)}${status(true)}
    <div class="pa-brand"><div class="pa-logo" aria-hidden="true">${img("logo.svg")}</div><h1 class="pa-display">Pulse</h1></div>
    <ul class="pa-features">${[
      ["ic-fitness.svg", "Every fitness activity", "Strength, cardio, mobility &amp; more"],
      ["ic-calendar.svg", "A routine without pressure", "Plan your week, change it anytime"],
      ["ic-monitoring.svg", "Track patterns &amp; habits", "See how training fits your life"],
    ].map(([i, t, s]) => `<li class="pa-feature pa-glass"><div class="pa-iconbox">${img(i)}</div><div><p class="pa-card-title">${t}</p><p class="pa-small">${s}</p></div></li>`).join("")}</ul>
    ${cta("Get Started", 2, { top: 700 })}
    <p class="pa-login"><span>Already have an account?</span><span>Log in</span></p>
    ${home("is-dim is-low")}`),

  // 02_GoalFraming
  screen(2, "What brings you here?", `${bg(1)}${status()}${back}${skip(3)}
    ${head("What brings you here?", "Pick the goals that matter most to you")}
    <div class="pa-list" role="group" aria-label="Goals">${GOALS.map((g) =>
      `<button type="button" class="pa-goal pa-hit" data-act="goal" data-goal="${esc(g)}" aria-pressed="false"><span>${esc(g)}</span><span class="pa-tick" aria-hidden="true">${img("ic-check.svg")}</span></button>`).join("")}</div>
    ${cta("Continue", 3, { extra: ' data-need="goals"' })}
    ${progress(35)}${home()}`),

  // 03_Preferences
  screen(3, "What do you love?", `${bg(3)}${status()}${back}${skip(4)}
    ${head("What do you love?", "Choose the activities to personalise your plan")}
    <div class="pa-list">${CATS.map((c, i) => `
      <div class="pa-cat pa-glass" data-cat="${i}">
        <button type="button" class="pa-cat-head pa-hit" data-act="cat" data-cat="${i}" aria-expanded="false" aria-controls="pa-cat-${i}" id="pa-cath-${i}">
          <span><span class="pa-cat-name">${esc(c.name)}</span>${c.sub ? `<span class="pa-cat-sub">${esc(c.sub)}</span>` : ""}</span>
          <span class="pa-cat-sign" aria-hidden="true">+</span>
        </button>
        <div class="pa-cat-panel" id="pa-cat-${i}" role="group" aria-labelledby="pa-cath-${i}" hidden>
          <div class="pa-chips">${c.chips.map((ch) => `<button type="button" class="pa-chip pa-hit" data-act="chip" data-chip="${esc(ch)}" aria-pressed="false"><span>${esc(ch)}</span></button>`).join("")}</div>
        </div>
      </div>`).join("")}</div>
    ${cta("Continue", 4)}
    ${progress(70)}${home()}`),

  // 04_CoreFlow
  screen(4, "Book your first workout", `${bg(2)}${status(true)}${back}
    <div class="pa-hero pa-tile" aria-hidden="true">${img("ic-fitness-lg.svg")}</div>
    <div class="pa-center" style="top:270px;gap:10px"><h2 class="pa-display">Book your first workout</h2><p class="pa-body" style="width:320px">Every workout in Pulse is free. <br>Want to book your first one now?</p></div>
    <ul class="pa-perks">
      <li class="pa-perk pa-glass"><div class="pa-iconbox">${img("ic-check-circle.svg")}</div><div><p class="pa-card-title">Free cancellation </p><p class="pa-small">Up to 12h before an activity</p></div></li>
      <li class="pa-perk pa-glass"><div class="pa-iconbox"><img src="${A("ic-swap.svg")}" alt="" loading="lazy" decoding="async" style="width:22px;height:25.143px"></div><div><p class="pa-card-title">Request a swap </p><p class="pa-small">Avoid a late cancelation fee and offer your spot to someone else</p></div></li>
    </ul>
    ${cta("Continue", 5, { top: 672 })}
    <button type="button" class="pa-skipnow pa-hit" data-act="go" data-to="10">Skip for now</button>
    ${home("is-dim is-low")}`),

  // 05_ChooseWorkout
  screen(5, "Choose a workout", `${glow("glow-workout.svg")}${status()}${back}
    ${head("Choose a workout", "The best matches to your chosen activities")}
    <div class="pa-grid" role="group" aria-label="Workouts">${WORKOUTS.map(([w, f]) =>
      `<button type="button" class="pa-workout pa-hit" data-act="workout" data-workout="${esc(w)}" aria-pressed="false"><span class="ph" aria-hidden="true">${img(f)}</span><span>${esc(w)}</span><span class="pa-tick" aria-hidden="true">${img("ic-check.svg")}</span></button>`).join("")}</div>
    ${cta("Continue", 6, { extra: ' data-need="workout"' })}
    ${home()}${progress(136)}`),

  // 06_ChooseStudio
  screen(6, "Choose a studio", `${glow()}${status()}${back}${home()}
    ${head("Choose a studio", "HIIT classes near you", 128, "classes")}
    <div class="pa-studios">${STUDIOS.map(([n, where, r, f]) =>
      `<button type="button" class="pa-studio pa-glass pa-hit" data-act="studio" data-studio="${esc(n)}"><span class="logo" aria-hidden="true">${img(f)}</span><span class="txt"><span class="pa-card-title">${esc(n)}</span><span class="where">${esc(where)}</span><span class="rating">${esc(r)}</span></span><span class="go" aria-hidden="true">${img("ic-chevron.svg")}</span></button>`).join("")}</div>
    ${progress(172)}`),

  // 07_ChooseTime
  screen(7, "Pick a time", `${glow()}${status()}${back}${home()}
    ${head("Pick a time", "Burn Club · HIIT", 128, "studioWorkout")}
    <div class="pa-days" role="group" aria-label="Day">${DAYS.map((d) =>
      `<button type="button" class="pa-day pa-hit" data-act="day" data-day="${esc(d.date)}" aria-pressed="false"><span class="d">${d.d}</span>${d.n ? `<span class="n">${d.n}</span>` : ""}</button>`).join("")}</div>
    <div class="pa-slots" role="group" aria-label="Classes">${SLOTS.map(([who, time, st], i) =>
      `<button type="button" class="pa-slot pa-glass pa-hit" data-act="slot" data-slot="${i}"${st === "full" ? ' aria-disabled="true" tabindex="-1"' : ""}><span class="who"><b>${esc(who)}</b><span>${time}</span></span><span class="state"><span class="pa-badge ${st}">${BADGE[st]}</span></span></button>`).join("")}</div>
    ${progress(202)}`),

  // 08_BookingConfirmation
  screen(8, "Confirm booking", `${glow()}${status()}${back}
    <div class="pa-confirm">
      <div class="pa-head" style="position:static">${`<h2 class="pa-display">Confirm booking</h2><p class="pa-body">Review your session details</p>`}</div>
      <div class="pa-summary pa-glass">
        <div class="top"><div class="pa-tile" aria-hidden="true">${img("ic-workout.svg")}</div><div><b data-bind="workout">HIIT</b><p class="pa-small" data-bind="studioCity">Burn Club · Berlin</p></div></div>
        <hr><div class="row"><span>Date</span><b data-bind="date">Mon, Dec 1</b></div>
        <hr><div class="row"><span>Time</span><b data-bind="time">08:00 – 08:45</b></div>
        <hr><div class="row"><span>Trainer</span><b data-bind="trainer">Mark A.</b></div>
      </div>
      <p class="pa-note">Free cancellation up to 12 hours before</p>
    </div>
    <button type="button" class="pa-slider pa-glass pa-hit" data-act="book"><span class="pa-fill" aria-hidden="true"></span><span class="pa-slide-label">Book now</span><span class="pa-knob" aria-hidden="true">${img("ic-arrow.svg")}</span></button>
    ${home()}${progress(220)}`),

  // 09_YoureBooked
  screen(9, "You're booked!", `${bg(1)}${status()}
    <div class="pa-center" style="top:250px;gap:20px"><div class="pa-booked" aria-hidden="true">${img("booked.svg")}</div><h2 class="pa-display">You're booked!</h2><p class="pa-body" style="width:320px" data-bind="booked">HIIT at Burn Club · Mon, Dec 1 · 08:00</p></div>
    <div class="pa-pill pa-glass" style="top:648px">Add to calendar</div>
    ${cta("Done", 10, { glow: true })}
    ${home()}`),

  // 10_Orientation
  screen(10, "You're all set", `${bg(2)}${status(true)}${home("is-dim")}${back}
    ${head("You're all set", "Here’s what you can do with Pulse", 120)}
    <ul class="pa-feats">${[
      ["ic-heart.svg", "Book in seconds", "Browse, book and save favorite classes"],
      ["ic-routine.svg", "Visit your routine", "Your goal-focused activity discovery"],
      ["ic-trophy.svg", "Take on challenges", "Stay motivated with achievable goals"],
      ["ic-log.svg", "Log and reflect", "Overview your habits and progression"],
    ].map(([i, t, s]) => `<li class="pa-feat pa-glass"><div class="pa-tile">${img(i)}</div><div><p class="pa-card-title">${t}</p><p class="pa-small">${s}</p></div></li>`).join("")}</ul>
    ${cta("Continue", 11, { glow: true })}`),

  // 11_NotificationsAllowance
  screen(11, "Stay in the loop", `${bg(3)}${status()}${home()}
    <div class="pa-center" style="top:240px;gap:20px"><div class="pa-bell pa-tile" aria-hidden="true">${img("ic-bell.svg")}</div><h2 class="pa-display">Stay in the loop</h2><p class="pa-body" style="width:310px">Receive details before class, waitlist updates and personal reminders.</p></div>
    ${cta("Enable notifications", 12, { top: 648, glow: true })}
    <button type="button" class="pa-pill pa-glass pa-hit" style="top:716px" data-act="go" data-to="12">Maybe later</button>`),

  // 12_NotificationsConfirmed
  screen(12, "Welcome to Pulse", `${bg(4)}${status()}${home()}
    <div class="pa-hello"><h2><span>Welcome to</span> <span>Pulse</span></h2></div>`),
];

/* ------------------------------ the app ------------------------------ */
/**
 * @param {HTMLElement} root   the .pa element inside .proto-screen
 * @param {{ gsap: any, reduce: boolean, navigate(to: number): void, back(): void, busy(on: boolean): void, isSettled(): boolean }} shell
 */
export function createApp(root, shell) {
  const { gsap, reduce } = shell;
  root.innerHTML = SCREENS.join("");
  const screens = [...root.querySelectorAll(".pa-screen")];
  const $ = (sel, n) => screens[n - 1].querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];
  let s = INITIAL();

  const slot = () => (s.slot == null ? null : SLOTS[s.slot]);
  const initials = (name) => { const [f, l] = name.split(" "); return `${f} ${l[0]}.`; };
  const choices = () => {
    const sl = slot();
    return {
      goals: GOALS.filter((g) => s.goals.includes(g)),
      activities: CATS.flatMap((c) => c.chips).filter((c) => s.activities.includes(c)),
      workout: s.workout, studio: s.studio, day: s.day,
      time: sl ? sl[1].slice(0, 5) : null, trainer: sl ? sl[0] : null,
    };
  };

  /* Reflects the state into the controls and the carried-through lines. */
  const sync = () => {
    $$("[data-goal]").forEach((b) => b.setAttribute("aria-pressed", String(s.goals.includes(b.dataset.goal))));
    $$("[data-chip]").forEach((b) => b.setAttribute("aria-pressed", String(s.activities.includes(b.dataset.chip))));
    $$("[data-workout]").forEach((b) => b.setAttribute("aria-pressed", String(s.workout === b.dataset.workout)));
    $$("[data-day]").forEach((b) => b.setAttribute("aria-pressed", String(s.day === b.dataset.day)));
    $$("[data-need]").forEach((b) => {
      const ok = b.dataset.need === "goals" ? s.goals.length > 0 : !!s.workout;
      if (ok) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
    });
    const workout = s.workout || "HIIT", studio = s.studio || "Burn Club";
    const sl = slot() || SLOTS[0];
    const text = {
      classes: `${workout} classes near you`,
      studioWorkout: `${studio} · ${workout}`,
      workout, studioCity: `${studio} · Berlin`, date: s.day,
      time: sl[1].replace("–", " – "), trainer: initials(sl[0]),
      booked: `${workout} at ${studio} · ${s.day} · ${sl[1].slice(0, 5)}`,
    };
    $$("[data-bind]").forEach((el) => { el.textContent = text[el.dataset.bind]; });
  };

  /* The categories: one open at a time. */
  const setOpen = (i, animate) => {
    s.open = i;
    $$(".pa-cat").forEach((card) => {
      const k = Number(card.dataset.cat), on = k === i;
      const headBtn = card.querySelector(".pa-cat-head"), panel = card.querySelector(".pa-cat-panel");
      const was = headBtn.getAttribute("aria-expanded") === "true";
      headBtn.setAttribute("aria-expanded", String(on));
      card.classList.toggle("is-open", on);
      card.querySelector(".pa-cat-sign").textContent = on ? "−" : "+";
      if (on === was) { panel.hidden = !on; return; }
      gsap.killTweensOf(panel);
      if (!animate || reduce) { panel.hidden = !on; gsap.set(panel, { clearProps: "height,opacity" }); return; }
      if (on) {
        panel.hidden = false;
        gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.34, ease: "power3.out", clearProps: "height,opacity" });
      } else {
        gsap.to(panel, { height: 0, opacity: 0, duration: 0.26, ease: "power2.inOut", onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: "height,opacity" }); } });
      }
    });
  };

  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  /* ------------------------------ Book now: drag, tap, keyboard ------------------------------ */
  const slider = $(".pa-slider", 8), knob = $(".pa-knob", 8), fill = $(".pa-fill", 8), label = $(".pa-slide-label", 8);
  const TRACK = 345, KNOB = 52, INSET = 1, MAX = TRACK - KNOB - 2 * INSET; // the knob rides 1px inside the track
  const k = { x: 0, pressed: false };
  let drag = null, sliding = null, booked = false;
  const paint = () => {
    const x = Math.max(0, Math.min(MAX, k.x)), p = x / MAX;
    knob.style.transform = `translate3d(${x}px,0,0) scale(${k.pressed ? 56 / 52 : 1})`;
    fill.style.transform = `translate3d(${INSET + x + KNOB / 2 - TRACK}px,0,0)`; // the fill ends under the knob's centre
    fill.style.opacity = k.pressed || x > 0 ? String(Math.min(1, 0.35 + p)) : "0";
    label.style.opacity = String(Math.max(0, 1 - p * 1.6));
  };
  const resetSlider = () => {
    sliding?.kill(); sliding = null; drag = null; booked = false;
    k.x = 0; k.pressed = false;
    slider.classList.remove("is-pressed", "is-done");
    knob.style.transition = "";
    paint();
  };
  const book = () => {
    if (booked) return;
    booked = true;
    shell.busy(false);
    shell.navigate(9);
  };
  /* Plays the rest of the slide from wherever the knob is, then books. */
  const finish = (duration) => {
    shell.busy(true);
    slider.classList.add("is-pressed");
    k.pressed = true;
    sliding = gsap.to(k, { x: MAX, duration, ease: duration > 0.3 ? "power2.inOut" : "power2.out", onUpdate: paint, onComplete: () => {
      slider.classList.add("is-done");
      k.pressed = false; paint();
      sliding = gsap.delayedCall(0.14, book);
    } });
  };
  const springBack = () => {
    slider.classList.remove("is-pressed");
    k.pressed = false;
    sliding = gsap.to(k, { x: 0, duration: 0.5, ease: "expo.out", onUpdate: paint, onComplete: () => { sliding = null; } });
  };
  const ready = () => shell.isSettled() && !booked && !sliding?.isActive?.();

  slider.addEventListener("pointerdown", (e) => {
    if (reduce || e.button !== 0 || !ready()) return;
    sliding?.kill(); sliding = null;
    slider.setPointerCapture(e.pointerId);
    const scale = root.getBoundingClientRect().width / 393 || 1;
    drag = { id: e.pointerId, x0: e.clientX, from: k.x, scale, moved: false };
    k.pressed = true;
    slider.classList.add("is-pressed");
    paint();
  });
  slider.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = (e.clientX - drag.x0) / drag.scale;
    if (Math.abs(dx) > 3) drag.moved = true;
    k.x = Math.max(0, Math.min(MAX, drag.from + dx)); // 1:1 with the pointer
    paint();
  });
  const release = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved } = drag;
    drag = null;
    if (slider.hasPointerCapture(e.pointerId)) slider.releasePointerCapture(e.pointerId);
    if (cancelled) { springBack(); return; }
    if (!moved) finish(0.5);                       // a tap plays the whole slide
    else if (k.x / MAX >= 0.85) finish(0.18);      // far enough: it eases home and books
    else springBack();                             // not far enough: it settles back
  };
  slider.addEventListener("pointerup", (e) => release(e, false));
  slider.addEventListener("pointercancel", (e) => release(e, true));
  slider.addEventListener("lostpointercapture", (e) => { if (drag) release(e, true); });

  /* ------------------------------ every other control ------------------------------ */
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || !root.contains(el) || el.getAttribute("aria-disabled") === "true") return;
    const { act } = el.dataset;
    if (act === "go") { shell.navigate(Number(el.dataset.to)); return; }
    if (act === "back") { shell.back(); return; }
    if (act === "goal") s.goals = toggle(s.goals, el.dataset.goal);
    else if (act === "chip") s.activities = toggle(s.activities, el.dataset.chip);
    else if (act === "cat") { const i = Number(el.dataset.cat); if (i !== s.open) setOpen(i, true); return; }
    else if (act === "workout") s.workout = el.dataset.workout;
    else if (act === "day") s.day = el.dataset.day;
    else if (act === "studio") { if (!shell.isSettled()) return; s.studio = el.dataset.studio; sync(); shell.navigate(7); return; }
    else if (act === "slot") { if (!shell.isSettled()) return; s.slot = Number(el.dataset.slot); sync(); shell.navigate(8); return; }
    else if (act === "book") {
      // Pointer taps and drags are handled above; this is the keyboard (Enter / Space) and reduced motion.
      if (!ready()) return;
      if (reduce) book();
      else if (e.detail === 0) finish(0.5);
      return;
    }
    sync();
  });

  const reset = () => {
    s = INITIAL();
    setOpen(0, false);
    $(".pa-slots", 7).scrollTop = 0;
    resetSlider();
    sync();
  };
  reset();

  return {
    screens,
    choices,
    reset,
    /** Called by the shell when a screen comes on. */
    enter(n) { if (n === 8) resetSlider(); },
  };
}
