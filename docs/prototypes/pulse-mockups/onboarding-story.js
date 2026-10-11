/* Pulse onboarding story on the mockup board.
   The phone pins; scroll picks the screen; each change plays itself (a slide, like the app's own
   navigation, forward or back) so nothing rests half-transitioned. Same pattern as the Cyvore story.
   The screens are the coded app (onboarding-app.js), played by a scripted user: within a screen's
   scroll its taps are scrubbed, each at its own point, and scrolling back undoes them. */

import { mountStoryScreens } from "./onboarding-app.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SCREENS = 12;
/** First and last screen (0-based) of each onboarding stage. */
export const STAGES = [
  { from: 0, to: 2 },  // frame the app, learn the goal
  { from: 3, to: 8 },  // the first booking
  { from: 9, to: 11 }, // tour, permissions, close
];
/** Pinned scroll per unit of weight, as a share of the viewport height. */
const UNIT_VH = 0.55;
/** Each screen's share of the scroll: room for its taps (02 and 03 have three, 07 two, 08 the slide). */
const WEIGHTS = [1, 1.6, 1.6, 1, 1, 1, 1.4, 1.4, 1, 1, 1, 1];
const STARTS = WEIGHTS.map((_, i) => WEIGHTS.slice(0, i).reduce((a, b) => a + b, 0));
const TOTAL = STARTS[SCREENS - 1] + WEIGHTS[SCREENS - 1];

export const stageOf = (beat) => STAGES.findIndex((s) => beat >= s.from && beat <= s.to);

/** How full each stage's bar is, 0–1, at a screen and how far into it. */
export function stageFills(beat, within) {
  return STAGES.map((s) => {
    if (beat > s.to) return 1;
    if (beat < s.from) return 0;
    return (beat - s.from + within) / (s.to - s.from + 1);
  });
}

function mountStory(root, name) {
  const track = root.querySelector(".ob-track");
  const pin = root.querySelector(".ob-pin");
  const screens = [...root.querySelectorAll(".ob-screen")];
  const caps = [...root.querySelectorAll(".ob-cap")];
  const fills = [...root.querySelectorAll(".ob-stage i")];
  const stages = [...root.querySelectorAll(".ob-stage")];
  const count = root.querySelector("[data-count]");
  const app = mountStoryScreens(root.querySelector(".phone-screen"), { gsap, still: false });

  let beat = -1;
  let settled = true;
  let tl = null;
  let lastFills = stageFills(0, 0);

  const pinTop = () => Math.max(16, (innerHeight - pin.offsetHeight) / 2);
  const layout = () => {
    root.style.setProperty("--pin-top", `${pinTop()}px`);
    track.style.height = `${pin.offsetHeight + TOTAL * UNIT_VH * innerHeight}px`;
  };
  layout();

  const opacity = (el) => parseFloat(gsap.getProperty(el, "opacity"));

  const setCaption = (b) => {
    caps.forEach((c, i) => c.classList.toggle("is-on", i === b));
    stages.forEach((s, i) => s.classList.toggle("is-on", i === stageOf(b)));
    count.textContent = `${String(b + 1).padStart(2, "0")} / ${SCREENS}`;
  };

  const goTo = (b, dir, instant = false) => {
    // A new change takes over from whatever is on screen: nothing snaps to full, nothing stacks.
    if (tl) { tl.kill(); tl = null; }
    setCaption(b);
    app.chrome(b + 1, !(instant || reduce || beat < 0)); // Back, Skip and the bar hold still; the bar eases to its fill
    const inn = screens[b];
    if (instant || reduce || beat < 0) {
      screens.forEach((s, i) => gsap.set(s, { autoAlpha: i === b ? 1 : 0, xPercent: 0 }));
      settled = true;
    } else {
      settled = false;
      const outs = screens.filter((s, i) => i !== b && opacity(s) > 0.001);
      const x = dir > 0 ? -18 : 18; // forward: the old screen leaves to the left, as in the app
      tl = gsap.timeline({
        onComplete: () => {
          screens.forEach((s, i) => { if (i !== b) gsap.set(s, { autoAlpha: 0, xPercent: 0 }); });
          settled = true;
          tl = null;
        },
      });
      if (outs.length) tl.to(outs, { autoAlpha: 0, xPercent: x, duration: 0.28, ease: "power2.in" }, 0);
      if (opacity(inn) > 0.001) tl.to(inn, { autoAlpha: 1, xPercent: 0, duration: 0.42, ease: "power3.out" }, 0.12);
      else tl.fromTo(inn, { autoAlpha: 0, xPercent: -x }, { autoAlpha: 1, xPercent: 0, duration: 0.42, ease: "power3.out" }, 0.12);
    }
    beat = b;
  };

  const update = (progress, dir) => {
    const u = Math.min(Math.max(progress, 0), 1) * TOTAL;
    let b = SCREENS - 1;
    while (b > 0 && u < STARTS[b]) b--;
    const within = Math.min((u - STARTS[b]) / WEIGHTS[b], 1);
    if (b !== beat) {
      // the screen it leaves rests as the user left it: all done going on, untouched going back
      if (beat >= 0) app.step(beat + 1, b > beat ? 1 : 0);
      goTo(b, dir || (b > beat ? 1 : -1));
    }
    app.step(b + 1, within);
    lastFills = stageFills(b, within);
    fills.forEach((f, i) => f.style.setProperty("--fill", lastFills[i].toFixed(3)));
  };

  const st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${pinTop()}px`,
    end: () => `bottom ${pinTop() + pin.offsetHeight}px`,
    invalidateOnRefresh: true,
    onRefreshInit: layout,
    onUpdate: (self) => update(self.progress, self.direction),
  });

  // Land on wherever the page already is.
  const span = st.end - st.start;
  update(span > 0 ? (window.scrollY - st.start) / span : 0, 1);

  (window.__pulseStories ||= {})[name] = {
    state: () => ({
      beat, settled, caption: caps.findIndex((c) => c.classList.contains("is-on")), stage: stageOf(beat), fills: lastFills,
      visible: screens.flatMap((s, i) => (opacity(s) > 0.01 ? [i] : [])),
      step: app.info(beat + 1),
    }),
    scrollToBeat: (b, within = 0.5) => window.scrollTo(0, st.start + ((STARTS[b] + within * WEIGHTS[b]) / TOTAL) * (st.end - st.start)),
  };
}

/** Reduced motion: no pin; the twelve screens as a still grid, each with its caption. */
function mountStatic(root, name) {
  root.classList.add("is-static");
  mountStoryScreens(root.querySelector(".phone-screen"), { gsap, still: true }); // each screen as it ends
  root.querySelectorAll(".ob-screen").forEach((s) => gsap.set(s, { autoAlpha: 1, xPercent: 0 }));
  (window.__pulseStories ||= {})[name] = { state: () => ({ static: true, screens: root.querySelectorAll(".ob-screen").length }) };
}

function boot() {
  const roots = [...document.querySelectorAll(".ob[data-story]")];
  // The phone shows the same story: copy the desktop markup in before anything mutates it.
  roots.filter((r) => r.dataset.clone).forEach((r) => {
    const src = document.querySelector(`.ob[data-story="${r.dataset.clone}"] .ob-pin`);
    r.querySelector(".ob-track").append(src.cloneNode(true));
  });
  roots.forEach((r) => (reduce ? mountStatic : mountStory)(r, r.dataset.story));
  if (!reduce) ScrollTrigger.refresh();
}

document.fonts.ready.then(boot);
