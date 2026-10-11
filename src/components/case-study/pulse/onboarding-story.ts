/* Pulse onboarding story, moved into the site from the board (docs/prototypes/pulse-mockups/onboarding-story.js).
   The phone pins; scroll picks the screen; each change plays itself (a slide, like the app's own navigation, forward
   or back) so nothing rests half-transitioned. The screens are the coded app (onboarding-app.ts), played by a
   scripted user on a clock, not the scroll: each screen arrives untouched, rests, then is tapped through at a person's
   pace, however fast the page is scrolled. Coming back to a screen plays it again. Left alone, a screen's last tap
   moves the story on, as the tap would in the app: the scroll is set to the next screen (invisible while pinned), so a
   scroll after carries on from there. Nothing plays unless the phone is pinned.
   Changes from the board, for the page: GSAP from npm; one story whose layout follows the page width (no cloned phone
   frame); everything it creates is released by the cleanup it returns; it pins below the site's fixed nav. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { mountStoryScreens, type StoryInfo } from "./onboarding-app";

gsap.registerPlugin(ScrollTrigger);

const SCREENS = 12;
/** First and last screen (0-based) of each onboarding stage. */
export const STAGES = [
  { from: 0, to: 2 },  // frame the app, learn the goal
  { from: 3, to: 8 },  // the first booking
  { from: 9, to: 11 }, // tour, permissions, close
];
/** Pinned scroll per unit of weight, as a share of the viewport height. */
const UNIT_VH = 0.55;
/** Each screen's share of the scroll: a little more where the play runs longer (02 and 03, 07, 08). */
const WEIGHTS = [1, 1.6, 1.6, 1, 1, 1, 1.4, 1.4, 1, 1, 1, 1];
const STARTS = WEIGHTS.map((_, i) => WEIGHTS.slice(0, i).reduce((a, b) => a + b, 0));
const TOTAL = STARTS[SCREENS - 1] + WEIGHTS[SCREENS - 1];
/** The site's fixed pill nav ends about here (src/components/shell/pill-nav.tsx); a pinned story starts below it. */
const NAV_CLEAR = 104;

export const stageOf = (beat: number) => STAGES.findIndex((s) => beat >= s.from && beat <= s.to);

/** How full each stage's bar is, 0–1, at a screen and how far into it. */
export function stageFills(beat: number, within: number) {
  return STAGES.map((s) => {
    if (beat > s.to) return 1;
    if (beat < s.from) return 0;
    return (beat - s.from + within) / (s.to - s.from + 1);
  });
}

export interface PulseStoryState {
  beat: number; settled: boolean; caption: number; stage: number; fills: number[]; visible: number[];
  step: Partial<StoryInfo> & { playing: boolean };
}
export interface PulseStoryApi {
  state(): PulseStoryState | { static: true; screens: number };
  scrollToBeat(beat: number, within?: number): void;
}
/** The test hook, as on the board: window.__pulseStories[name]. */
const hooks = () => ((window as unknown as { __pulseStories?: Record<string, PulseStoryApi> }).__pulseStories ||= {});
const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement;
const qa = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];

export function mountPulseStory(root: HTMLElement, name: string): () => void {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const track = q(root, ".ob-track");
  const pin = q(root, ".ob-pin");
  const screens = qa(root, ".ob-screen");
  const caps = qa(root, ".ob-cap");
  const fills = qa(root, ".ob-stage i");
  const stages = qa(root, ".ob-stage");
  const count = q(root, "[data-count]");
  const app = mountStoryScreens(q(root, ".phone-screen"), { still: false });

  let beat = -1;
  let settled = true;
  let tl: gsap.core.Timeline | null = null;
  let lastFills = stageFills(0, 0);
  // The scripted user's clock for the screen on show; it runs only while the phone is pinned.
  const clock = { t: 0 };
  let play: gsap.core.Tween | null = null;
  let inView = false;
  const stop = () => { play?.kill(); play = null; };
  const start = (n: number) => {
    stop();
    clock.t = 0;
    app.step(n, 0);
    if (!inView) return;
    const length = app.length(n);
    if (!length) return;
    play = gsap.to(clock, {
      t: length, duration: length, ease: "none",
      onUpdate: () => app.step(n, clock.t),
      onComplete: () => {
        app.step(n, Infinity);
        play = null;
        // the last tap was the step forward: the next screen follows it, unless the user has already moved on
        // (and never behind the open prototype, which would leave the page somewhere else on close)
        const protoOpen = document.querySelector<HTMLElement>("[data-proto]")?.hidden === false;
        if (inView && !protoOpen && beat === n - 1 && n < SCREENS) scrollTo(n, 0.02);
      },
    });
  };

  // Centred when it fits below the site's fixed nav; otherwise as far below it as the screen allows (never under 16px).
  const pinTop = () => {
    const free = innerHeight - pin.offsetHeight;
    return Math.max(16, free / 2 >= NAV_CLEAR ? free / 2 : Math.min(NAV_CLEAR, free - 16));
  };
  const layout = () => {
    root.style.setProperty("--pin-top", `${pinTop()}px`);
    track.style.height = `${pin.offsetHeight + TOTAL * UNIT_VH * innerHeight}px`;
  };
  layout();

  const opacity = (el: HTMLElement) => parseFloat(String(gsap.getProperty(el, "opacity")));

  const setCaption = (b: number) => {
    caps.forEach((c, i) => c.classList.toggle("is-on", i === b));
    stages.forEach((s, i) => s.classList.toggle("is-on", i === stageOf(b)));
    count.textContent = `${String(b + 1).padStart(2, "0")} / ${SCREENS}`;
  };

  const goTo = (b: number, dir: number, instant = false) => {
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

  const update = (progress: number, dir: number) => {
    const u = Math.min(Math.max(progress, 0), 1) * TOTAL;
    let b = SCREENS - 1;
    while (b > 0 && u < STARTS[b]) b--;
    const within = Math.min((u - STARTS[b]) / WEIGHTS[b], 1);
    if (b !== beat) {
      // the screen it leaves rests as the user left it: all done going on, untouched going back
      stop();
      if (beat >= 0) app.step(beat + 1, b > beat ? Infinity : 0);
      goTo(b, dir || (b > beat ? 1 : -1));
      start(b + 1);
    }
    lastFills = stageFills(b, within);
    fills.forEach((f, i) => f.style.setProperty("--fill", lastFills[i].toFixed(3)));
  };

  const scrollTo = (b: number, within: number) =>
    window.scrollTo({ top: st.start + ((STARTS[b] + within * WEIGHTS[b]) / TOTAL) * (st.end - st.start), behavior: "instant" });
  // Pinned is "in view": the play starts there, and starts over if the story is left and come back to.
  const setInView = (on: boolean) => { if (on === inView) return; inView = on; start(beat + 1); };

  const st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${pinTop()}px`,
    end: () => `bottom ${pinTop() + pin.offsetHeight}px`,
    invalidateOnRefresh: true,
    onRefreshInit: layout,
    onUpdate: (self) => update(self.progress, self.direction),
    onToggle: (self) => setInView(self.isActive),
  });

  // Land on wherever the page already is.
  const span = st.end - st.start;
  update(span > 0 ? (window.scrollY - st.start) / span : 0, 1);
  setInView(st.isActive);

  const api: PulseStoryApi = {
    state: () => ({
      beat, settled, caption: caps.findIndex((c) => c.classList.contains("is-on")), stage: stageOf(beat), fills: lastFills,
      visible: screens.flatMap((s, i) => (opacity(s) > 0.01 ? [i] : [])),
      step: { ...(app.info(beat + 1) ?? {}), playing: !!play },
    }),
    scrollToBeat: (b, within = 0.5) => scrollTo(b, within),
  };
  hooks()[name] = api;
  ScrollTrigger.refresh();

  return () => {
    stop();
    tl?.kill();
    st.kill();
    app.destroy();
    gsap.killTweensOf(screens);
    if (hooks()[name] === api) delete hooks()[name];
  };
}

/** Reduced motion: no pin; the twelve screens as a still grid, each with its caption. */
export function mountPulseStatic(root: HTMLElement, name: string): () => void {
  root.classList.add("is-static");
  const app = mountStoryScreens(q(root, ".phone-screen"), { still: true }); // each screen as it ends
  qa(root, ".ob-screen").forEach((s) => gsap.set(s, { autoAlpha: 1, xPercent: 0 }));
  const api: PulseStoryApi = { state: () => ({ static: true, screens: qa(root, ".ob-screen").length }), scrollToBeat: () => {} };
  hooks()[name] = api;
  return () => {
    app.destroy();
    root.classList.remove("is-static");
    if (hooks()[name] === api) delete hooks()[name];
  };
}
