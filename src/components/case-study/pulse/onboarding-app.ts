/* Pulse onboarding, moved into the site from the board (docs/prototypes/pulse-mockups/onboarding-app.js): types added,
   assets served from /case-studies/pulse/app/, GSAP from npm; the logic is the board's.

   Pulse onboarding, coded from the Figma file (0W2igIjHC2Qx9qVBVA1lFX, frames 01_Welcome … 12_NotificationsConfirmed).
   The 12 screens as real HTML in the frames' own 393 × 852 units (styles: onboarding-app.css), every control the file
   has made to work, and the choices carried from screen to screen. The overlay shell (open, close, history, the push
   transition) lives in onboarding-proto.js and drives this through createApp(). The scroll story on the board shows
   the same screens, display only, played by a scripted user: mountStoryScreens(). */

import { gsap } from "gsap";

const A = (f: string) => `/case-studies/pulse/app/${f}`;
const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement;
const qa = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];

/* ------------------------------ content (the Figma text, verbatim) ------------------------------ */
const GOALS = ["Get stronger", "Stay active", "Feel more energized", "Become more flexible", "Lose weight"];
/* Strength & Conditioning is the file's own open card. Cardio's chips are the file's Cardio list
   (02_ActivitiesCategoriesCardio) less Boxing, already under Strength here, and Dance, which has its own category.
   Mind & Body: Yoga is the file's; Pilates and Mobility are added. Dance & Movement: Dance is the file's; Zumba and
   Barre are added. The file has no subtitle for the three collapsed categories, so they open without one. */
const CATS: { name: string; sub?: string; chips: string[] }[] = [
  { name: "Strength & Conditioning", sub: "High-intensity & functional training", chips: ["HIIT", "Hyrox", "Weight Lifting", "Bodyweight", "Boxing"] },
  { name: "Cardio & Endurance", chips: ["Spinning", "Swimming", "Running", "Rowing"] },
  { name: "Mind & Body", chips: ["Yoga", "Pilates", "Mobility"] },
  { name: "Dance & Movement", chips: ["Dance", "Zumba", "Barre"] },
];
const WORKOUTS: [string, string][] = [
  ["HIIT", "workout-hiit.jpg"], ["Hyrox", "workout-hyrox.jpg"], ["Crossfit", "workout-crossfit.jpg"],
  ["Open Gym", "workout-opengym.jpg"], ["Calisthenic", "workout-calisthenic.jpg"], ["Weight Lifting", "workout-weightlifting.jpg"],
];
const STUDIOS: [string, string, string, string][] = [
  ["Burn Club", "Danziger · 1.5 km", "4.9 rating", "studio-burnclub.jpg"],
  ["Iron Yard", "Kreuzberg · 2.1 km", "4.8 rating", "studio-ironyard.jpg"],
  ["Sweat Lab", "Mitte · 3.4 km", "4.7 rating", "studio-sweatlab.jpg"],
  ["Studio 9", "Prenzlauer · 4.0 km", "4.9 rating", "studio-studio9.jpg"],
];
/* Mon 1st is Mon, Dec 1 (08_BookingConfirmation); the other chips follow the same calendar. */
const DAYS: { d: string; n?: string; date: string }[] = [
  { d: "Today", date: "Sun, Nov 30" },
  { d: "Mon", n: "1st", date: "Mon, Dec 1" },
  { d: "Tue", n: "2nd", date: "Tue, Dec 2" },
  { d: "Wed", n: "3rd", date: "Wed, Dec 3" },
  { d: "Thu", n: "4th", date: "Thu, Dec 4" },
];
type SlotState = "full" | "spots" | "open";
const SLOTS: [string, string, SlotState][] = [
  ["Mark Adams", "08:00–08:45", "full"], ["Tory Green", "09:00–09:45", "full"], ["Elena Rodriguez", "10:00–10:45", "full"],
  ["Maya Thompson", "11:00–11:45", "spots"], ["Leon Smith", "12:00–12:45", "open"], ["Mark Anderson", "13:00–13:45", "open"],
  ["Mark Anderson", "14:00–14:45", "open"],
];
const BADGE: Record<SlotState, string> = { full: "Fully booked", spots: "1 spot left", open: "Available" };

/* Nothing is picked until the user picks it. Strength & Conditioning opens as the file draws it: layout, not a choice. */
export interface Choices {
  goals: string[]; activities: string[]; open: number;
  workout: string | null; studio: string | null; day: string | null; slot: number | null;
}
export const INITIAL = (): Choices => ({
  goals: [], activities: [], open: 0,
  workout: null, studio: null, day: null, slot: null,
});

/* ------------------------------ markup ------------------------------ */
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img = (f: string, cls = "") => `<img src="${A(f)}" alt=""${cls ? ` class="${cls}"` : ""} loading="lazy" decoding="async" draggable="false">`;
const status = (solid?: boolean) => `<div aria-hidden="true"><span class="pa-time">9:41</span><span class="pa-batt${solid ? " is-solid" : ""}"></span></div>`;
const home = (cls = "") => `<div class="pa-home ${cls}" aria-hidden="true"></div>`;
/* The fixed layer (makeChrome), per screen: where Skip goes, and the bar's fill in px of 220 (the file's own fills; 04
   has no bar in the file, so its step is the midpoint between 03 and 05, keeping the bar on from 02 to 08). */
const CHROME: Record<number, { back?: boolean; skip?: number; bar?: number }> = {
  2: { back: true, skip: 3, bar: 35 }, 3: { back: true, skip: 4, bar: 70 }, 4: { back: true, bar: 103 },
  5: { back: true, bar: 136 }, 6: { back: true, bar: 172 }, 7: { back: true, bar: 202 }, 8: { back: true, bar: 220 },
  10: { back: true },
};
const BAR = 220;
const CHROME_HTML = `<div class="pa-chrome">
  <button type="button" class="pa-back pa-glass pa-hit" data-act="back" aria-label="Back">${img("ic-back.svg")}</button>
  <button type="button" class="pa-skip pa-hit" data-act="go">Skip</button>
  <div class="pa-progress" role="progressbar" aria-label="Onboarding progress" aria-valuemin="0" aria-valuemax="100"><i></i></div>
</div>`;
const cta = (label: string, to: number | null, { top = 716, glow = false, act = "go", extra = "" } = {}) =>
  `<button type="button" class="pa-cta pa-hit${glow ? " is-glow" : ""}" style="top:${top}px" data-act="${act}"${to ? ` data-to="${to}"` : ""}${extra}>${label}</button>`;
const head = (title: string, sub: string, top = 128, bind = "") =>
  `<div class="pa-head" style="top:${top}px"><h2 class="pa-display">${title}</h2><p class="pa-body"${bind ? ` data-bind="${bind}"` : ""}>${sub}</p></div>`;
const bg = (n: number) => `<div class="pa-bg" aria-hidden="true">${img(`bg-${n}.svg`)}</div>`;
const glow = (f = "glow.svg") => `<div aria-hidden="true">${img(f, "pa-glow")}</div>`;
const screen = (n: number, label: string, inner: string) =>
  `<section class="pa-screen" data-screen="${n}" aria-label="${esc(label)}" tabindex="-1">${inner}<div class="pa-shade" aria-hidden="true"></div></section>`;

/** The 12 screens' markup; `id` keeps the ids unique when the screens are on the page more than once. */
export const screensHTML = (id: string): string[] => [
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
  screen(2, "What brings you here?", `${bg(1)}${status()}
    ${head("What brings you here?", "Pick the goals that matter most to you")}
    <div class="pa-list" role="group" aria-label="Goals">${GOALS.map((g) =>
      `<button type="button" class="pa-goal pa-hit" data-act="goal" data-goal="${esc(g)}" aria-pressed="false"><span>${esc(g)}</span><span class="pa-tick" aria-hidden="true">${img("ic-check.svg")}</span></button>`).join("")}</div>
    ${cta("Continue", 3, { extra: ' data-need="goals"' })}
    ${home()}`),

  // 03_Preferences
  screen(3, "What do you love?", `${bg(3)}${status()}
    ${head("What do you love?", "Choose the activities to personalise your plan")}
    <div class="pa-list">${CATS.map((c, i) => `
      <div class="pa-cat pa-glass" data-cat="${i}">
        <button type="button" class="pa-cat-head pa-hit" data-act="cat" data-cat="${i}" aria-expanded="false" aria-controls="${id}-cat-${i}" id="${id}-cath-${i}">
          <span><span class="pa-cat-name">${esc(c.name)}</span>${c.sub ? `<span class="pa-cat-sub">${esc(c.sub)}</span>` : ""}</span>
          <span class="pa-cat-sign" aria-hidden="true">+</span>
        </button>
        <div class="pa-cat-panel" id="${id}-cat-${i}" role="group" aria-labelledby="${id}-cath-${i}" hidden>
          <div class="pa-chips">${c.chips.map((ch) => `<button type="button" class="pa-chip pa-hit" data-act="chip" data-chip="${esc(ch)}" aria-pressed="false"><span>${esc(ch)}</span></button>`).join("")}</div>
        </div>
      </div>`).join("")}</div>
    ${cta("Continue", 4, { extra: ' data-need="activities"' })}
    ${home()}`),

  // 04_CoreFlow
  screen(4, "Book your first workout", `${bg(2)}${status(true)}
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
  screen(5, "Choose a workout", `${glow("glow-workout.svg")}${status()}
    ${head("Choose a workout", "The best matches to your chosen activities")}
    <div class="pa-grid" role="group" aria-label="Workouts">${WORKOUTS.map(([w, f]) =>
      `<button type="button" class="pa-workout pa-hit" data-act="workout" data-workout="${esc(w)}" aria-pressed="false"><span class="ph" aria-hidden="true">${img(f)}</span><span>${esc(w)}</span><span class="pa-tick" aria-hidden="true">${img("ic-check.svg")}</span></button>`).join("")}</div>
    ${home()}`),

  // 06_ChooseStudio
  screen(6, "Choose a studio", `${glow()}${status()}${home()}
    ${head("Choose a studio", "HIIT classes near you", 128, "classes")}
    <div class="pa-studios">${STUDIOS.map(([n, where, r, f]) =>
      `<button type="button" class="pa-studio pa-glass pa-hit" data-act="studio" data-studio="${esc(n)}"><span class="logo" aria-hidden="true">${img(f)}</span><span class="txt"><span class="pa-card-title">${esc(n)}</span><span class="where">${esc(where)}</span><span class="rating">${esc(r)}</span></span><span class="go" aria-hidden="true">${img("ic-chevron.svg")}</span></button>`).join("")}</div>
    `),

  // 07_ChooseTime
  screen(7, "Pick a time", `${glow()}${status()}${home()}
    ${head("Pick a time", "Burn Club · HIIT", 128, "studioWorkout")}
    <div class="pa-days" role="group" aria-label="Day"><span class="pa-days-ring" aria-hidden="true"></span>${DAYS.map((d) =>
      `<button type="button" class="pa-day pa-hit" data-act="day" data-day="${esc(d.date)}" aria-pressed="false"><span class="d">${d.d}</span>${d.n ? `<span class="n">${d.n}</span>` : ""}</button>`).join("")}</div>
    <div class="pa-slots" role="group" aria-label="Classes">${SLOTS.map(([who, time, st], i) =>
      `<button type="button" class="pa-slot pa-glass pa-hit" data-act="slot" data-slot="${i}" aria-disabled="true" tabindex="-1"><span class="who"><b>${esc(who)}</b><span>${time}</span></span><span class="state"><span class="pa-badge ${st}">${BADGE[st]}</span></span></button>`).join("")}</div>
    `),

  // 08_BookingConfirmation
  screen(8, "Confirm booking", `${glow()}${status()}
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
    ${home()}`),

  // 09_YoureBooked
  screen(9, "You're booked!", `${bg(1)}${status()}
    <div class="pa-center" style="top:250px;gap:20px"><div class="pa-booked" aria-hidden="true">${img("booked.svg")}</div><h2 class="pa-display">You're booked!</h2><p class="pa-body" style="width:320px" data-bind="booked">HIIT at Burn Club · Mon, Dec 1 · 08:00</p></div>
    <div class="pa-pill pa-glass" style="top:648px">Add to calendar</div>
    ${cta("Done", 10, { glow: true })}
    ${home()}`),

  // 10_Orientation
  screen(10, "You're all set", `${bg(2)}${status(true)}${home("is-dim")}
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

/* ------------------------------ state → screen (shared by the prototype and the story) ------------------------------ */
const initials = (name: string) => { const [f, l] = name.split(" "); return `${f} ${l[0]}.`; };
const pressedIf = (els: NodeListOf<HTMLElement>, on: (b: HTMLElement) => boolean) => els.forEach((b) => b.setAttribute("aria-pressed", String(on(b))));

/** Reflects a choice state into every control and carried-through line under `root`. */
function reflect(root: ParentNode, s: Choices) {
  const all = (sel: string) => root.querySelectorAll<HTMLElement>(sel);
  pressedIf(all("[data-goal]"), (b) => s.goals.includes(b.dataset.goal!));
  pressedIf(all("[data-chip]"), (b) => s.activities.includes(b.dataset.chip!));
  pressedIf(all("[data-workout]"), (b) => s.workout === b.dataset.workout);
  pressedIf(all("[data-day]"), (b) => s.day === b.dataset.day);
  // Continue holds until its screen has a pick (02: a goal, 03: an activity).
  all("[data-need]").forEach((b) => { if (s[b.dataset.need as "goals" | "activities"].length) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true"); });
  // The class times wait for a day: dimmed and out of reach until one is picked; fully booked ones stay out.
  all(".pa-slots").forEach((el) => el.toggleAttribute("data-wait", !s.day));
  all("[data-slot]").forEach((b) => {
    if (!s.day || SLOTS[Number(b.dataset.slot)][2] === "full") { b.setAttribute("aria-disabled", "true"); b.tabIndex = -1; }
    else { b.removeAttribute("aria-disabled"); b.removeAttribute("tabindex"); }
  });
  // Lines on screens the flow can't reach yet read as the file's own (HIIT · Burn Club · Mon, Dec 1 · Mark Adams).
  const workout = s.workout || "HIIT", studio = s.studio || "Burn Club", day = s.day || DAYS[1].date;
  const sl = s.slot == null ? SLOTS[0] : SLOTS[s.slot];
  const text: Record<string, string> = {
    classes: `${workout} classes near you`,
    studioWorkout: `${studio} · ${workout}`,
    workout, studioCity: `${studio} · Berlin`, date: day,
    time: sl[1].replace("–", " – "), trainer: initials(sl[0]),
    booked: `${workout} at ${studio} · ${day} · ${sl[1].slice(0, 5)}`,
  };
  all("[data-bind]").forEach((el) => { const t = text[el.dataset.bind!]; if (el.textContent !== t) el.textContent = t; });
}

/** A category card open or shut, at once. */
function catState(card: HTMLElement, on: boolean) {
  q(card, ".pa-cat-head").setAttribute("aria-expanded", String(on));
  card.classList.toggle("is-open", on);
  q(card, ".pa-cat-sign").textContent = on ? "−" : "+";
  q(card, ".pa-cat-panel").hidden = !on;
}

/* Book now: the knob rides 1px inside the track; the fill ends under the knob's centre. Transform and opacity only. */
const TRACK = 345, KNOB = 52, INSET = 1, MAX = TRACK - KNOB - 2 * INSET;
interface SliderParts { slider: HTMLElement; knob: HTMLElement; fill: HTMLElement; label: HTMLElement }
const sliderParts = (root: ParentNode): SliderParts | null => {
  const slider = root.querySelector<HTMLElement>(".pa-slider");
  return slider && { slider, knob: q(slider, ".pa-knob"), fill: q(slider, ".pa-fill"), label: q(slider, ".pa-slide-label") };
};
function paintSlider({ knob, fill, label }: SliderParts, x0: number, pressed: boolean) {
  const x = Math.max(0, Math.min(MAX, x0)), p = x / MAX;
  knob.style.transform = `translate3d(${x}px,0,0) scale(${pressed ? 56 / 52 : 1})`;
  fill.style.transform = `translate3d(${INSET + x + KNOB / 2 - TRACK}px,0,0)`;
  fill.style.opacity = pressed || x > 0 ? String(Math.min(1, 0.35 + p)) : "0";
  label.style.opacity = String(Math.max(0, 1 - p * 1.6));
}

/* Back, Skip and the progress bar sit in one layer over the screens, as an app's navigation bar does: they stay still
   while the screens slide under them, Back and Skip fade only where a screen has none, and the bar eases to its new
   fill. Returns set(screen, animate). */
function makeChrome(ch: HTMLElement) {
  const cBack = q(ch, ".pa-back"), cSkip = q(ch, ".pa-skip"), cBar = q(ch, ".pa-progress"), cFill = q(cBar, "i");
  let barW = 0;
  const showPart = (el: HTMLElement, on: boolean, animate: boolean) => {
    el.inert = !on;
    gsap.killTweensOf(el, "opacity,visibility");
    if (!animate) gsap.set(el, { autoAlpha: on ? 1 : 0 });
    else gsap.to(el, { autoAlpha: on ? 1 : 0, duration: on ? 0.3 : 0.2, ease: "power2.out" });
  };
  return (n: number, animate: boolean) => {
    const c = CHROME[n] || {};
    showPart(cBack, !!c.back, animate);
    showPart(cSkip, !!c.skip, animate);
    if (c.skip) cSkip.dataset.to = String(c.skip);
    showPart(cBar, c.bar != null, animate);
    if (c.bar == null) return;
    cBar.setAttribute("aria-valuenow", String(Math.round((c.bar / BAR) * 100)));
    // The fill is the full bar slid left; the track's rounded clip shapes its start. Transform only.
    const from = barW || c.bar;
    barW = c.bar;
    gsap.killTweensOf(cFill);
    if (!animate || from === c.bar) gsap.set(cFill, { x: c.bar - BAR });
    else gsap.fromTo(cFill, { x: from - BAR }, { x: c.bar - BAR, duration: 0.42, ease: "power3.out" });
  };
}

/* ------------------------------ the app ------------------------------ */
/** What the overlay shell gives the app (onboarding-proto.ts). */
export interface AppShell {
  reduce: boolean;
  navigate(to: number): void;
  back(): void;
  busy(on: boolean): void;
  isSettled(): boolean;
}
export interface PublicChoices {
  goals: string[]; activities: string[]; workout: string | null; studio: string | null; day: string | null;
  time: string | null; trainer: string | null;
}
export interface AppApi {
  screens: HTMLElement[];
  choices(): PublicChoices;
  reset(): void;
  enter(n: number, animate?: boolean): void;
}

/** @param root the .pa element inside .proto-screen */
export function createApp(root: HTMLElement, shell: AppShell): AppApi {
  const { reduce } = shell;
  root.innerHTML = screensHTML("pa").join("") + CHROME_HTML;
  const screens = qa(root, ".pa-screen");
  const $ = (sel: string, n: number) => q(screens[n - 1], sel);
  const $$ = (sel: string) => qa(root, sel);
  let s = INITIAL();

  const slot = () => (s.slot == null ? null : SLOTS[s.slot]);
  const choices = (): PublicChoices => {
    const sl = slot();
    return {
      goals: GOALS.filter((g) => s.goals.includes(g)),
      activities: CATS.flatMap((c) => c.chips).filter((c) => s.activities.includes(c)),
      workout: s.workout, studio: s.studio, day: s.day,
      time: sl ? sl[1].slice(0, 5) : null, trainer: sl ? sl[0] : null,
    };
  };

  const sync = () => reflect(root, s);

  /* The categories: one open at a time. */
  const setOpen = (i: number, animate: boolean) => {
    s.open = i;
    $$(".pa-cat").forEach((card) => {
      const on = Number(card.dataset.cat) === i, panel = q(card, ".pa-cat-panel");
      const was = q(card, ".pa-cat-head").getAttribute("aria-expanded") === "true";
      catState(card, on);
      if (on === was) return;
      gsap.killTweensOf(panel);
      if (!animate || reduce) { gsap.set(panel, { clearProps: "height,opacity" }); return; }
      panel.hidden = false; // shown while it folds open or shut
      if (on) {
        gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.34, ease: "power3.out", clearProps: "height,opacity" });
      } else {
        gsap.to(panel, { height: 0, opacity: 0, duration: 0.26, ease: "power2.inOut", onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: "height,opacity" }); } });
      }
    });
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  /* ------------------------------ Book now: drag, tap, keyboard ------------------------------ */
  const parts = sliderParts(screens[7])!, { slider, knob } = parts;
  const k = { x: 0, pressed: false };
  let drag: { id: number; x0: number; from: number; scale: number; moved: boolean } | null = null;
  let sliding: gsap.core.Tween | null = null, booked = false;
  const paint = () => paintSlider(parts, k.x, k.pressed);
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
  const finish = (duration: number) => {
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
  const release = (e: PointerEvent, cancelled: boolean) => {
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
  /* 07 before a day is picked: a tap on a class time points at the days, not at every control. */
  const days = $(".pa-days", 7);
  let nudgeT: ReturnType<typeof setTimeout> | undefined;
  const nudge = () => {
    clearTimeout(nudgeT);
    days.classList.remove("is-nudge");
    void days.offsetWidth; // replay from the start on a second tap
    days.classList.add("is-nudge");
    nudgeT = setTimeout(() => days.classList.remove("is-nudge"), 1100);
  };

  root.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-act]");
    if (!el || !root.contains(el)) return;
    if (el.dataset.act === "slot" && !s.day) { e.stopPropagation(); nudge(); return; } // the shell's misclick hint stays off
    if (el.getAttribute("aria-disabled") === "true") return;
    const { act } = el.dataset;
    if (act === "go") { shell.navigate(Number(el.dataset.to)); return; }
    if (act === "back") { shell.back(); return; }
    if (act === "goal") s.goals = toggle(s.goals, el.dataset.goal!);
    else if (act === "chip") s.activities = toggle(s.activities, el.dataset.chip!);
    else if (act === "cat") { const i = Number(el.dataset.cat); if (i !== s.open) setOpen(i, true); return; }
    else if (act === "workout") {
      // A pick-one screen: the tapped tile lights up for a beat, then the studios slide in.
      if (!shell.isSettled()) return;
      s.workout = el.dataset.workout ?? null; sync();
      if (reduce) { shell.navigate(6); return; }
      shell.busy(true);
      gsap.delayedCall(0.18, () => { shell.busy(false); shell.navigate(6); });
      return;
    }
    else if (act === "day") s.day = el.dataset.day ?? null;
    else if (act === "studio") { if (!shell.isSettled()) return; s.studio = el.dataset.studio ?? null; sync(); shell.navigate(7); return; }
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

  /* ------------------------------ the fixed layer: Back, Skip, the bar ------------------------------ */
  const chromeFor = makeChrome(q(root, ".pa-chrome"));

  const reset = () => {
    s = INITIAL();
    clearTimeout(nudgeT);
    days.classList.remove("is-nudge");
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
    /** Called by the shell when a screen comes on; animate when it slides in. */
    enter(n: number, animate = false) { if (n === 8) resetSlider(); chromeFor(n, animate && !reduce); },
  };
}

/* ------------------------------ the scroll story: the same screens, played by a scripted user ------------------------------ */
/* What the user does on each screen (the Figma file's own picks) and when, in seconds from the screen's arrival: the
   screen slides in (~0.55s), rests untouched, then the finger taps at a person's pace. Scroll only picks the screen; this
   clock keeps the rhythm, so a fast scroll never skips the untouched state. `pick` changes the state; a tap without one
   is on a control that moves on (Continue and the like). 08's slide runs from `at` to `to`. */
export interface Step { name: string; at: number; el: string; pick?: (s: Choices) => void; to?: number; slide?: boolean }
const tap = (name: string, at: number, el: string, pick?: (s: Choices) => void): Step => ({ name, at, el, pick });
export const SCRIPT: Record<number, Step[]> = {
  1: [tap("Get Started", 1.7, ".pa-cta")],
  2: [
    tap("Get stronger", 1.7, '[data-goal="Get stronger"]', (s) => s.goals.push("Get stronger")),
    tap("Stay active", 2.35, '[data-goal="Stay active"]', (s) => s.goals.push("Stay active")),
    tap("Continue", 3.05, ".pa-cta"),
  ],
  3: [
    tap("HIIT", 1.7, '[data-chip="HIIT"]', (s) => s.activities.push("HIIT")),
    tap("Hyrox", 2.35, '[data-chip="Hyrox"]', (s) => s.activities.push("Hyrox")),
    tap("Continue", 3.05, ".pa-cta"),
  ],
  4: [tap("Continue", 1.7, ".pa-cta")],
  5: [tap("HIIT", 1.7, '[data-workout="HIIT"]', (s) => { s.workout = "HIIT"; })],
  6: [tap("Burn Club", 1.7, '[data-studio="Burn Club"]', (s) => { s.studio = "Burn Club"; })],
  7: [
    tap("Mon 1st", 1.7, '[data-day="Mon, Dec 1"]', (s) => { s.day = "Mon, Dec 1"; }),
    tap("Maya Thompson", 2.45, '[data-slot="3"]', (s) => { s.slot = 3; }),
  ],
  8: [{ name: "Book now", at: 1.7, to: 2.45, el: ".pa-slider", slide: true }],
  9: [tap("Done", 1.7, ".pa-cta")],
  10: [tap("Continue", 1.7, ".pa-cta")],
  11: [tap("Enable notifications", 1.7, ".pa-cta")],
  12: [],
};
export const stepEnd = (st: Step) => st.to ?? st.at;
/** The choices on screen n once its first k steps are done (every earlier screen's picks made). */
export const stateAt = (n: number, k: number) => {
  const s = INITIAL();
  for (let i = 1; i <= n; i++) SCRIPT[i].slice(0, i < n ? undefined : k).forEach((st) => st.pick?.(s));
  return s;
};

/* The finger: it arrives (fades in, settles), presses, the control changes, it lifts and fades. Seconds before and
   after the step's time. */
const ARRIVE = 0.4, PRESS = 0.12, LIFT = 0.3, HOLD = 0.08;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** The finger's opacity and scale at w for a step, and whether the control is held down; null when it's away. */
function finger(st: Step, w: number) {
  const a = st.at, b = stepEnd(st);
  if (w < a - ARRIVE || w > b + LIFT) return null;
  if (w < a) {
    const arrive = smooth(clamp01((w - (a - ARRIVE)) / (ARRIVE - PRESS))), down = smooth(clamp01((w - (a - PRESS)) / PRESS));
    return { o: arrive, sc: 1.25 - 0.25 * arrive - 0.2 * down, down: w >= a - PRESS };
  }
  if (w < b) return { o: 1, sc: 0.8, down: true }; // held while the knob slides
  const up = smooth(clamp01((w - b) / LIFT));
  return { o: 1 - up, sc: 0.8 + 0.2 * up, down: w < b + HOLD };
}

let storyUid = 0;
export interface StoryInfo { screen: number; t: number; done: string[]; tap: boolean; taps: number[] }
export interface StoryScreens {
  step(n: number, w: number): void;
  chrome(n: number, animate: boolean): void;
  length(n: number): number;
  info(n: number): StoryInfo | null;
  /** releases the screens' observers and listeners */
  destroy(): void;
}
interface Fig {
  n: number; host: HTMLElement; root: HTMLElement; steps: Step[]; els: HTMLElement[]; mark: HTMLElement;
  slider: SliderParts | null; k: number; pos: { x: number; y: number }[] | null; last: string; held: HTMLElement | null; knob: string; on: boolean;
}

/**
 * The scroll story's screens: each `.ob-screen` figure under `phone` gets its coded screen (display only: inert),
 * plus, while scrolling, one fixed Back / Skip / bar layer over them all. `still` renders each screen as it ends,
 * every pick made and nothing moving (the reduced-motion grid).
 * @param phone the .phone-screen holding the 12 figures
 */
export function mountStoryScreens(phone: HTMLElement, { still }: { still: boolean }): StoryScreens {
  const html = screensHTML(`ob${++storyUid}`);
  const figs: Fig[] = qa(phone, ".ob-screen").map((fig, i) => {
    const n = i + 1, host = q(fig, ".ob-app");
    host.innerHTML = `<div class="pa is-story" inert>${html[i]}${still ? CHROME_HTML : '<i class="pa-tap" aria-hidden="true"></i>'}</div>`;
    const root = host.firstElementChild as HTMLElement;
    qa(root, ".pa-cat").forEach((card) => catState(card, card.dataset.cat === "0"));
    const steps = SCRIPT[n];
    return { n, host, root, steps, els: steps.map((st) => q(root, st.el)), mark: q(root, ".pa-tap"), slider: sliderParts(root), k: -1, pos: null, last: "", held: null, knob: "", on: false };
  });

  // The frames' 393 × 852 units, scaled to the phone (or, in the grid, to one cell).
  const sizer = still ? figs[0].host : phone;
  const fit = () => { const w = sizer.clientWidth; if (w) phone.style.setProperty("--pa-s", String(w / 393)); };
  const ro = new ResizeObserver(fit);
  ro.observe(sizer);
  fit();

  if (still) {
    figs.forEach((f) => {
      reflect(f.root, stateAt(f.n, f.steps.length));
      makeChrome(q(f.root, ".pa-chrome"))(f.n, false);
      if (f.slider) { paintSlider(f.slider, MAX, false); f.slider.slider.classList.add("is-done"); }
    });
    return { step() {}, chrome() {}, length: () => 0, info: () => null, destroy: () => ro.disconnect() };
  }

  phone.insertAdjacentHTML("beforeend", `<div class="ob-chrome" aria-hidden="true"><div class="pa is-story" inert>${CHROME_HTML}</div></div>`);
  const setChrome = makeChrome(q(phone, ".ob-chrome .pa-chrome"));

  /* Where the finger lands on each step's control, in the frame's units. Read once (and again when the app's fonts
     arrive), never while scrolling. */
  const measure = () => figs.forEach((f) => {
    const r = f.root.getBoundingClientRect(), s = r.width / 393 || 1;
    f.pos = f.els.map((el, i) => {
      const b = el.getBoundingClientRect();
      const x = f.steps[i].slide ? b.left + INSET + KNOB / 2 : b.left + b.width / 2; // 08: the knob's centre at rest
      return { x: (x - r.left) / s, y: (b.top + b.height / 2 - r.top) / s };
    });
  });
  measure();
  const remeasure = () => requestAnimationFrame(measure);
  document.fonts.addEventListener("loadingdone", remeasure);

  const within: number[] = new Array(figs.length).fill(0);
  /** Poses screen n at w seconds into its play (Infinity: finished): its picks so far, the held control, the finger,
      08's knob. */
  const step = (n: number, w: number) => {
    const f = figs[n - 1];
    within[n - 1] = w;
    const k = f.steps.filter((st) => w >= stepEnd(st)).length;
    if (k !== f.k) { f.k = k; reflect(f.root, stateAt(n, k)); }
    let pose: ReturnType<typeof finger> = null, at = -1;
    // the first step whose finger is near (a plain loop so the type checker follows the assignment)
    for (let i = 0; i < f.steps.length && !pose; i++) { const p = finger(f.steps[i], w); if (p) { pose = p; at = i; } }
    // the control under the finger, held down
    const held = pose?.down && !f.steps[at].slide ? f.els[at] : null; // 08's knob shows its own press
    if (held !== f.held) { f.held?.removeAttribute("data-press"); held?.setAttribute("data-press", ""); f.held = held; }
    // 08: the knob follows the scroll, the fill and label as the real slider paints them
    let ride = 0;
    if (f.slider) {
      const st = f.steps[0];
      const to = stepEnd(st);
      ride = MAX * smooth(clamp01((w - st.at) / (to - st.at)));
      const down = w >= st.at - PRESS && w < to, knobKey = `${ride.toFixed(2)}|${down}`;
      if (knobKey !== f.knob) {
        f.knob = knobKey;
        paintSlider(f.slider, ride, down);
        f.slider.slider.classList.toggle("is-pressed", down);
        f.slider.slider.classList.toggle("is-done", w >= to);
      }
    }
    const key = pose ? `${at}|${pose.o.toFixed(3)}|${pose.sc.toFixed(3)}|${ride.toFixed(1)}` : "";
    if (key === f.last) return;
    f.last = key;
    f.on = !!pose && pose.o > 0.01;
    if (!pose) { f.mark.style.opacity = "0"; return; }
    const p = f.pos![at];
    f.mark.style.transform = `translate3d(${p.x + (f.steps[at].slide ? ride : 0)}px,${p.y}px,0) scale(${pose.sc})`;
    f.mark.style.opacity = String(pose.o * 0.9);
  };
  figs.forEach((f) => step(f.n, 0));

  return {
    step,
    /** Back, Skip and the bar for screen n; animate when the screens slide. */
    chrome: (n: number, animate: boolean) => setChrome(n, animate),
    /** How long screen n's play runs, in seconds: its last step and the finger lifting. */
    length: (n: number) => Math.max(0, ...figs[n - 1].steps.map((st) => stepEnd(st) + LIFT)),
    /** The story's test hook for screen n. */
    info: (n: number) => {
      const f = figs[n - 1], w = within[n - 1];
      return {
        screen: n, t: w,
        done: f.steps.filter((st) => w >= stepEnd(st)).map((st) => st.name),
        tap: f.on, taps: f.steps.map((st) => st.at),
      };
    },
    destroy: () => { ro.disconnect(); document.fonts.removeEventListener("loadingdone", remeasure); },
  };
}
