/* Cyvore story replica, the board's engine (docs/prototypes/cyvore-mockups/story-board.js) moved into the site.
   Scroll picks the beat; the beat plays itself. Only the attack video follows the scroll.
   Spec: docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md. Changes from the board, for the page:
   GSAP from npm; everything it creates is released by the cleanup it returns; the phone layout (.is-phone) follows
   the page width instead of a cloned phone frame; the attack clip loads when the story nears the screen, from its
   URL (the board fetched it as a blob for a server without byte ranges); the static copies sit beside React's
   markup instead of replacing it. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BEATS, CHAPTERS, TOTAL_WEIGHT, beatAt, beatStart, firstBeatOf, chapterFill,
  STATS, formatStat, captionAt, scrubTime, type ChapterId,
} from "@/lib/case-studies/cyvore-story";

gsap.registerPlugin(ScrollTrigger);

const SETTLE = "power3.out";
/** One weight unit of pinned scroll, as a share of the viewport height. */
const UNIT_VH = 0.33;
/** Below this page width the replica is the board's phone version (columns become rows). */
const PHONE_BELOW = 1100;
/** The site's fixed pill nav ends about here (src/components/shell/pill-nav.tsx); a pinned story starts below it. */
const NAV_CLEAR = 104;

type TabList = HTMLElement & { hoverTimer?: ReturnType<typeof setTimeout>; hoverTab?: HTMLElement | null };
type Fill = Record<ChapterId, number>;
export interface CyvoreState {
  beat: number; chapter: ChapterId | null; settled: boolean; fill: Fill; visible: ChapterId[];
  open: { why: number; risk: number }; caption: number; lit: number[]; statText: string | null;
}
export interface CyvoreApi {
  state(): CyvoreState | { static: true; copies: number };
  scrollToBeat(beat: number, within?: number): void;
}
/** The test hook, as on the board: window.__cyvoreStories[name]. */
const hooks = () => ((window as unknown as { __cyvoreStories?: Record<string, CyvoreApi> }).__cyvoreStories ||= {});

const prefersReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const chapterEl = (site: ParentNode, ch: ChapterId) => site.querySelector(`[data-chapter="${ch}"]`) as HTMLElement;
const listIn = (site: ParentNode, ch: ChapterId) => chapterEl(site, ch).querySelector('.panels[role="tablist"]') as TabList;
const openIndex = (list: HTMLElement) => [...list.querySelectorAll('[role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true");

/* ---------- columns ---------- */

function countUp(el: HTMLElement, instant: boolean) {
  const stat = STATS[Number(el.dataset.stat)];
  gsap.killTweensOf(el);
  if (instant || prefersReduced()) { el.textContent = formatStat(stat, 1); return; }
  const o = { t: 0 };
  el.textContent = formatStat(stat, 0);
  // starts as the column finishes widening (the body fades in at 400ms)
  gsap.to(o, { t: 1, duration: 0.9, delay: 0.45, ease: "none", onUpdate: () => { el.textContent = formatStat(stat, o.t); } });
}

/** Opens column i (null closes all). Statistics count up as they open. */
export function openPanel(list: TabList, i: number | null, { instant = false } = {}) {
  // Whatever opens a column (a beat, a click, a key) cancels a hover still waiting to fire.
  clearTimeout(list.hoverTimer);
  list.hoverTab = null;
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  tabs.forEach((t, k) => {
    t.setAttribute("aria-selected", String(k === i));
    t.tabIndex = k === (i ?? 0) ? 0 : -1;
  });
  if (i === null) return;
  const num = tabs[i].querySelector<HTMLElement>("[data-stat]");
  if (num) countUp(num, instant);
}

/* Where the mouse last was, so a column moving under a still mouse isn't mistaken for a hover. */
const lastPointer = { x: NaN, y: NaN };
// Half a pixel of tolerance: Chrome quantises pointer positions (to 1/64px).
const pointerMoved = (e: PointerEvent) => !(Math.abs(e.clientX - lastPointer.x) < 0.5 && Math.abs(e.clientY - lastPointer.y) < 0.5);
const recordPointer = (e: PointerEvent) => { lastPointer.x = e.clientX; lastPointer.y = e.clientY; };

/** Hover (mouse only, after a beat), click/tap and arrow keys, as on the live site. Returns the cleanup. */
export function bindPanels(root: ParentNode, { instant = false } = {}) {
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };
  root.querySelectorAll<TabList>('.panels[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    tabs.forEach((t, i) => {
      on(t, "click", () => {
        if (t.getAttribute("aria-selected") === "true") return; // already open: nothing to redo
        openPanel(list, i, { instant });
      });
      // Hover means the mouse moved onto a column. A column sliding under a resting mouse
      // (the story scrolling) sends events at the same position; those don't count.
      on(t, "pointermove", (e) => {
        if (e.pointerType !== "mouse" || !pointerMoved(e)) return;
        if (t.getAttribute("aria-selected") === "true" || list.hoverTab === t) return;
        clearTimeout(list.hoverTimer);
        list.hoverTab = t; // armed once on entry: a mouse still moving across the column opens it too
        list.hoverTimer = setTimeout(() => { list.hoverTab = null; openPanel(list, i, { instant }); }, prefersReduced() ? 0 : 90);
      });
      on(t, "pointerleave", () => { clearTimeout(list.hoverTimer); list.hoverTab = null; });
      on(t, "keydown", (e) => {
        // the phone version stacks the columns, so its arrows go up and down
        const vertical = !!list.closest(".is-phone");
        const step: Record<string, number> = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
        let j: number | null = null;
        if (e.key in step) j = (i + step[e.key] + tabs.length) % tabs.length;
        if (e.key === "Home") j = 0;
        if (e.key === "End") j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        openPanel(list, j, { instant });
        tabs[j].focus();
      });
    });
    off.push(() => { clearTimeout(list.hoverTimer); });
  });
  return () => off.forEach((f) => f());
}

/* ---------- chapters ---------- */

function showOnly(site: ParentNode, ch: ChapterId) {
  CHAPTERS.forEach((c) => {
    const el = chapterEl(site, c);
    const on = c === ch;
    el.classList.toggle("is-on", on);
    el.inert = !on;
    gsap.set(el, { autoAlpha: on ? 1 : 0, y: 0 });
  });
}

function setBar(site: HTMLElement, beat: number, within: number): Fill {
  const fill = chapterFill(beat, within);
  const current = BEATS[beat].chapter;
  site.querySelectorAll<HTMLElement>(".chap[data-go]").forEach((c) => {
    const ch = c.dataset.go as ChapterId;
    c.setAttribute("aria-selected", String(ch === current));
    c.style.setProperty("--fill", fill[ch].toFixed(3));
    c.toggleAttribute("data-done", fill[ch] >= 1 && ch !== current);
  });
  return fill;
}

/** The diagram draws from the top node down, the engines light one by one, the lines meet below. */
export function powersTimeline(site: ParentNode) {
  const ch = chapterEl(site, "powers");
  const wires = ch.querySelector(".wires");
  const engines = [...ch.querySelectorAll(".eng")];
  gsap.set(wires, { clipPath: "inset(0% 0% 100% 0%)" });
  gsap.set(engines, { "--lit": 0 });
  return gsap.timeline({ paused: true })
    .to(wires, { clipPath: "inset(0% 0% 72% 0%)", duration: 0.35, ease: "none" })
    .to(engines, { "--lit": 1, duration: 0.3, stagger: 0.18, ease: "power1.out" })
    .to(wires, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.35, ease: "none" });
}

/* ---------- the story ---------- */

export function mountCyvoreStory(story: HTMLElement, name: string): () => void {
  const reduce = prefersReduced();
  const track = story.querySelector(".story-track") as HTMLElement;
  const pin = story.querySelector(".story-pin") as HTMLElement;
  const site = story.querySelector(".site") as HTMLElement;
  const where = site.querySelector("[data-where]") as HTMLElement;
  const powers = powersTimeline(site);
  const video = chapterEl(site, "attack").querySelector("video") as HTMLVideoElement;
  const caps = [...chapterEl(site, "attack").querySelectorAll(".s-caps li")];
  const setCaption = (k: number) => caps.forEach((li, i) => li.classList.toggle("is-on", i === k));
  const stats = [...site.querySelectorAll<HTMLElement>("[data-stat]")];
  video.pause();

  let beat = -1;
  let chapter: ChapterId | null = null;
  let settled = true;
  let tl: gsap.core.Timeline | null = null;
  let fill = chapterFill(0, 0);
  const cleanups: (() => void)[] = [];

  document.addEventListener("pointermove", recordPointer);
  cleanups.push(() => document.removeEventListener("pointermove", recordPointer));

  // The board's phone frame, by width: columns become rows, the bar a 2 × 2 grid.
  const page = (story.closest(".cs") as HTMLElement | null) ?? document.body;
  const fitPhone = () => {
    const phone = page.clientWidth < PHONE_BELOW;
    if (site.classList.contains("is-phone") === phone) return;
    site.classList.toggle("is-phone", phone);
    ScrollTrigger.refresh();
  };
  site.classList.toggle("is-phone", page.clientWidth < PHONE_BELOW);
  const ro = new ResizeObserver(fitPhone);
  ro.observe(page);
  cleanups.push(() => ro.disconnect());

  // Centred when it fits below the site's fixed nav; otherwise as far below it as the screen allows (never under 16px).
  const pinTop = () => {
    const free = innerHeight - pin.offsetHeight;
    return Math.max(16, free / 2 >= NAV_CLEAR ? free / 2 : Math.min(NAV_CLEAR, free - 16));
  };
  const layout = () => {
    story.style.setProperty("--pin-top", `${pinTop()}px`);
    track.style.height = `${pin.offsetHeight + TOTAL_WEIGHT * UNIT_VH * innerHeight}px`;
  };
  layout();

  const applyBeat = (b: number, instant: boolean, keepBuilt = false) => {
    const B = BEATS[b];
    if (B.chapter === "why" || B.chapter === "risk") openPanel(listIn(site, B.chapter), B.panel ?? null, { instant });
    // Built once per visit: scrolling back from the release into the build keeps it drawn.
    if (B.kind === "build") {
      if (instant || keepBuilt) powers.progress(1);
      else powers.restart();
    }
    if (B.kind === "release") powers.progress(1);
  };

  const goTo = (b: number, dir: number, instant = false) => {
    const next = BEATS[b].chapter;
    if (next !== chapter) {
      const from = chapter;
      // A chapter left behind starts fresh next time it is entered.
      if (from === "powers") powers.pause(0);
      if (from === "attack") setCaption(-1);
      chapter = next;
      where.textContent = `Chapter ${CHAPTERS.indexOf(next) + 1} of ${CHAPTERS.length}`;
      // A new handover takes over from whatever is on screen: the running one is dropped,
      // not completed, so a chapter the visitor is scrolling past never flashes to full.
      if (tl) { tl.kill(); tl = null; }
      if (!from || instant || reduce) {
        showOnly(site, next);
        applyBeat(b, true);
        settled = true;
      } else {
        settled = false;
        const inn = chapterEl(site, next);
        const y = dir > 0 ? -16 : 16;
        const opacity = (el: HTMLElement) => parseFloat(String(gsap.getProperty(el, "opacity")));
        const outs = CHAPTERS.filter((c) => c !== next).map((c) => chapterEl(site, c)).filter((el) => opacity(el) > 0.001);
        CHAPTERS.forEach((c) => { chapterEl(site, c).inert = c !== next; });
        const already = opacity(inn);
        tl = gsap.timeline({
          onComplete: () => {
            CHAPTERS.forEach((c) => {
              if (c === next) return;
              const el = chapterEl(site, c);
              el.classList.remove("is-on");
              gsap.set(el, { autoAlpha: 0, y: 0 });
            });
            settled = true;
            tl = null;
          },
        });
        if (outs.length) tl.to(outs, { autoAlpha: 0, y, duration: 0.36, ease: "power2.in" });
        tl.call(() => { inn.classList.add("is-on"); applyBeat(b, false); });
        if (already > 0.001) tl.to(inn, { autoAlpha: 1, y: 0, duration: 0.52, ease: SETTLE });
        else tl.fromTo(inn, { autoAlpha: 0, y: -y }, { autoAlpha: 1, y: 0, duration: 0.52, ease: SETTLE });
      }
    } else {
      applyBeat(b, instant, dir < 0);
    }
    beat = b;
  };

  const update = (progress: number, dir: number) => {
    const { beat: b, within } = beatAt(progress);
    if (b !== beat) goTo(b, dir || (b > beat ? 1 : -1));
    fill = setBar(site, b, within);
    if (BEATS[b].kind === "scrub") {
      const t = scrubTime(within, video.duration);
      // Seek only after a first frame has been decoded: seeking at metadata-only can leave the
      // stage unpainted. (readyState itself dips during every seek, so it can't be the gate.)
      if (video.dataset.decoded && Math.abs(video.currentTime - t) > 0.03) video.currentTime = t;
      // The caption follows where the scroll is taking the clip, once the clip's length is known.
      setCaption(Number.isFinite(video.duration) && video.duration > 0 ? captionAt(t) : -1);
    }
  };

  const st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${pinTop()}px`,
    end: () => `bottom ${pinTop() + pin.offsetHeight}px`,
    invalidateOnRefresh: true,
    onRefreshInit: layout,
    onUpdate: (self) => update(self.progress, self.direction),
  });
  cleanups.push(() => st.kill());

  const onDecoded = () => { video.dataset.decoded = "1"; update(st.progress, 0); };
  // ready to scrub: the whole clip can play through, so a seek never waits on the network
  const onReady = () => { video.dataset.scrub = "ready"; };
  video.addEventListener("loadeddata", onDecoded);
  video.addEventListener("canplaythrough", onReady);
  cleanups.push(() => { video.removeEventListener("loadeddata", onDecoded); video.removeEventListener("canplaythrough", onReady); });
  if (video.readyState >= 2) video.dataset.decoded = "1"; // it may have loaded before we listened
  // The clip loads whole once the story is near, so scrubbing seeks without waiting.
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    video.preload = "auto";
    video.load();
    near.disconnect();
  }, { rootMargin: "100% 0px" });
  near.observe(story);
  cleanups.push(() => near.disconnect());

  cleanups.push(bindPanels(site));

  // The bar is the live site's chapter switch, and now also the story's index.
  site.querySelectorAll<HTMLElement>(".chap[data-go]").forEach((c) => {
    const jump = () => {
      const p = beatStart(firstBeatOf(c.dataset.go as ChapterId));
      window.scrollTo({ top: st.start + p * (st.end - st.start) + 2, behavior: reduce ? "auto" : "smooth" });
    };
    c.addEventListener("click", jump);
    cleanups.push(() => c.removeEventListener("click", jump));
  });

  // Land directly on wherever the page already is (a reload mid-story replays nothing).
  // Read from the scroll position itself: st.progress isn't trustworthy before the first update.
  const span = st.end - st.start;
  const first = beatAt(span > 0 ? (window.scrollY - st.start) / span : 0);
  goTo(first.beat, 1, true);
  fill = setBar(site, first.beat, first.within);

  const api: CyvoreApi = {
    state: () => {
      const risk = listIn(site, "risk");
      const openStat = risk.querySelectorAll('[role="tab"]')[openIndex(risk)];
      return {
        beat, chapter, settled, fill,
        visible: CHAPTERS.filter((c) => parseFloat(getComputedStyle(chapterEl(site, c)).opacity) > 0.01),
        open: { why: openIndex(listIn(site, "why")), risk: openIndex(risk) },
        caption: [...site.querySelectorAll('[data-chapter="attack"] .s-caps li')].findIndex((li) => li.classList.contains("is-on")),
        lit: [...site.querySelectorAll(".eng")].map((e) => parseFloat(getComputedStyle(e).getPropertyValue("--lit")) || 0),
        statText: openStat ? (openStat.querySelector("[data-stat]") as HTMLElement).textContent : null,
      };
    },
    scrollToBeat: (b, within = 0.5) => {
      const p = beatStart(b) + (within * BEATS[b].weight) / TOTAL_WEIGHT;
      window.scrollTo(0, st.start + p * (st.end - st.start));
    },
  };
  hooks()[name] = api;
  ScrollTrigger.refresh();

  return () => {
    cleanups.forEach((f) => f());
    tl?.kill();
    powers.kill();
    gsap.killTweensOf(stats);
    CHAPTERS.forEach((c) => gsap.killTweensOf(chapterEl(site, c)));
    video.pause();
    if (hooks()[name] === api) delete hooks()[name];
  };
}

/** Reduced motion: no pin, no scrub. Four still copies of the site, each on its chapter, fully open. */
export function mountCyvoreStatic(story: HTMLElement, name: string): () => void {
  const site = story.querySelector(".site") as HTMLElement;
  story.classList.add("is-static");
  const unbind: (() => void)[] = [];
  const copies = CHAPTERS.map((ch, idx) => {
    const copy = site.cloneNode(true) as HTMLElement;
    copy.toggleAttribute("data-copy", true);
    showOnly(copy, ch);
    copy.querySelectorAll<HTMLElement>(".chap[data-go]").forEach((c) => {
      const on = c.dataset.go === ch;
      c.setAttribute("aria-selected", String(on));
      c.style.setProperty("--fill", on ? "1" : "0");
    });
    (copy.querySelector("[data-where]") as HTMLElement).textContent = `Chapter ${idx + 1} of ${CHAPTERS.length}`;
    if (ch === "why" || ch === "risk") openPanel(listIn(copy, ch), 0, { instant: true });
    if (ch === "attack") copy.querySelectorAll(".s-caps li").forEach((li) => li.classList.add("is-on"));
    if (ch === "powers") powersTimeline(copy).progress(1);
    unbind.push(bindPanels(copy, { instant: true }));
    return copy;
  });
  copies.forEach((copy) => copy.querySelectorAll<HTMLElement>(".chap[data-go]").forEach((c) => {
    c.addEventListener("click", () => copies[CHAPTERS.indexOf(c.dataset.go as ChapterId)].scrollIntoView({ block: "center" }));
  }));
  // React owns the original: it stays in place, hidden, and the copies go after it.
  site.hidden = true;
  site.after(...copies);
  const api: CyvoreApi = { state: () => ({ static: true, copies: copies.length }), scrollToBeat: () => {} };
  hooks()[name] = api;
  return () => {
    unbind.forEach((f) => f());
    copies.forEach((c) => c.remove());
    site.hidden = false;
    story.classList.remove("is-static");
    if (hooks()[name] === api) delete hooks()[name];
  };
}
