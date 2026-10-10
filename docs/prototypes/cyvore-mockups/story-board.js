/* Cyvore story replica on the mockup board.
   Scroll picks the beat; the beat plays itself. Only the attack video follows the scroll.
   Spec: docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md */
import {
  BEATS, CHAPTERS, TOTAL_WEIGHT, beatAt, beatStart, firstBeatOf, chapterFill,
  STATS, formatStat, captionAt, scrubTime,
} from "./cyvore-story.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SETTLE = "power3.out";
/** One weight unit of pinned scroll, as a share of the viewport height. */
const UNIT_VH = 0.33;

const chapterEl = (site, ch) => site.querySelector(`[data-chapter="${ch}"]`);
const listIn = (site, ch) => chapterEl(site, ch).querySelector('.panels[role="tablist"]');
const openIndex = (list) => [...list.querySelectorAll('[role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true");

/* ---------- columns ---------- */

function countUp(el, instant) {
  const stat = STATS[Number(el.dataset.stat)];
  gsap.killTweensOf(el);
  if (instant || reduce) { el.textContent = formatStat(stat, 1); return; }
  const o = { t: 0 };
  el.textContent = formatStat(stat, 0);
  // starts as the column finishes widening (the body fades in at 400ms)
  gsap.to(o, { t: 1, duration: 0.9, delay: 0.45, ease: "none", onUpdate: () => { el.textContent = formatStat(stat, o.t); } });
}

/** Opens column i (null closes all). Statistics count up as they open. */
export function openPanel(list, i, { instant = false } = {}) {
  // Whatever opens a column (a beat, a click, a key) cancels a hover still waiting to fire.
  clearTimeout(list.hoverTimer);
  list.hoverTab = null;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, k) => {
    t.setAttribute("aria-selected", String(k === i));
    t.tabIndex = k === (i ?? 0) ? 0 : -1;
  });
  if (i === null) return;
  const num = tabs[i].querySelector("[data-stat]");
  if (num) countUp(num, instant);
}

/* Where the mouse last was, so a column moving under a still mouse isn't mistaken for a hover. */
const lastPointer = { x: NaN, y: NaN };
// Half a pixel of tolerance: Chrome quantises pointer positions (to 1/64px).
const pointerMoved = (e) => !(Math.abs(e.clientX - lastPointer.x) < 0.5 && Math.abs(e.clientY - lastPointer.y) < 0.5);
// Bubble phase: columns compare first, then the position is recorded.
document.addEventListener("pointermove", (e) => { lastPointer.x = e.clientX; lastPointer.y = e.clientY; });

/** Hover (mouse only, after a beat), click/tap and arrow keys, as on the live site. */
export function bindPanels(root, { instant = false } = {}) {
  root.querySelectorAll('.panels[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const vertical = !!list.closest(".is-phone");
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => {
        if (t.getAttribute("aria-selected") === "true") return; // already open: nothing to redo
        openPanel(list, i, { instant });
      });
      // Hover means the mouse moved onto a column. A column sliding under a resting mouse
      // (the story scrolling) sends events at the same position; those don't count.
      t.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse" || !pointerMoved(e)) return;
        if (t.getAttribute("aria-selected") === "true" || list.hoverTab === t) return;
        clearTimeout(list.hoverTimer);
        list.hoverTab = t; // armed once on entry: a mouse still moving across the column opens it too
        list.hoverTimer = setTimeout(() => { list.hoverTab = null; openPanel(list, i, { instant }); }, reduce ? 0 : 90);
      });
      t.addEventListener("pointerleave", () => { clearTimeout(list.hoverTimer); list.hoverTab = null; });
      t.addEventListener("keydown", (e) => {
        const step = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
        let j = null;
        if (e.key in step) j = (i + step[e.key] + tabs.length) % tabs.length;
        if (e.key === "Home") j = 0;
        if (e.key === "End") j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        openPanel(list, j, { instant });
        tabs[j].focus();
      });
    });
  });
}

/* ---------- chapters ---------- */

function showOnly(site, ch) {
  CHAPTERS.forEach((c) => {
    const el = chapterEl(site, c);
    const on = c === ch;
    el.classList.toggle("is-on", on);
    el.inert = !on;
    gsap.set(el, { autoAlpha: on ? 1 : 0, y: 0 });
  });
}

function setBar(site, beat, within) {
  const fill = chapterFill(beat, within);
  const current = BEATS[beat].chapter;
  site.querySelectorAll(".chap[data-go]").forEach((c) => {
    const ch = c.dataset.go;
    c.setAttribute("aria-selected", String(ch === current));
    c.style.setProperty("--fill", fill[ch].toFixed(3));
    c.toggleAttribute("data-done", fill[ch] >= 1 && ch !== current);
  });
  return fill;
}

/** The diagram draws from the top node down, the engines light one by one, the lines meet below. */
export function powersTimeline(site) {
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

/* ---------- a story ---------- */

export function mountStory(story, name) {
  const track = story.querySelector(".story-track");
  const pin = story.querySelector(".story-pin");
  const site = story.querySelector(".site");
  const where = site.querySelector("[data-where]");
  const powers = powersTimeline(site);
  const video = chapterEl(site, "attack").querySelector("video");
  const caps = [...chapterEl(site, "attack").querySelectorAll(".s-caps li")];
  const setCaption = (k) => caps.forEach((li, i) => li.classList.toggle("is-on", i === k));
  video.pause();

  let beat = -1;
  let chapter = null;
  let settled = true;
  let tl = null;
  let fill = chapterFill(0, 0);

  const pinTop = () => Math.max(16, (innerHeight - pin.offsetHeight) / 2);
  const layout = () => {
    story.style.setProperty("--pin-top", `${pinTop()}px`);
    track.style.height = `${pin.offsetHeight + TOTAL_WEIGHT * UNIT_VH * innerHeight}px`;
  };
  layout();

  const applyBeat = (b, instant, keepBuilt = false) => {
    const B = BEATS[b];
    if (B.chapter === "why" || B.chapter === "risk") openPanel(listIn(site, B.chapter), B.panel, { instant });
    // Built once per visit: scrolling back from the release into the build keeps it drawn.
    if (B.kind === "build") {
      if (instant || keepBuilt) powers.progress(1);
      else powers.restart();
    }
    if (B.kind === "release") powers.progress(1);
  };

  const goTo = (b, dir, instant = false) => {
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
        const opacity = (el) => parseFloat(gsap.getProperty(el, "opacity"));
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

  const update = (progress, dir) => {
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
  video.addEventListener("loadeddata", () => { video.dataset.decoded = "1"; update(st.progress, 0); });
  if (video.readyState >= 2) video.dataset.decoded = "1"; // it may have loaded before we listened
  // Scrubbing needs the whole clip in memory: a blob URL seeks instantly on any host,
  // including servers without byte-range support. Skipped if the source was changed meanwhile.
  const original = video.getAttribute("src");
  fetch(original)
    .then((r) => r.blob())
    .then((blob) => {
      if (video.getAttribute("src") !== original) return;
      video.addEventListener("loadeddata", () => { video.dataset.scrub = "ready"; }, { once: true });
      video.src = URL.createObjectURL(blob);
    })
    .catch(() => {});

  bindPanels(site);

  // The bar is the live site's chapter switch, and now also the story's index.
  site.querySelectorAll(".chap[data-go]").forEach((c) => {
    c.addEventListener("click", () => {
      const p = beatStart(firstBeatOf(c.dataset.go));
      window.scrollTo({ top: st.start + p * (st.end - st.start) + 2, behavior: reduce ? "auto" : "smooth" });
    });
  });

  // Land directly on wherever the page already is (a reload mid-story replays nothing).
  // Read from the scroll position itself: st.progress isn't trustworthy before the first update.
  const span = st.end - st.start;
  const first = beatAt(span > 0 ? (window.scrollY - st.start) / span : 0);
  goTo(first.beat, 1, true);
  fill = setBar(site, first.beat, first.within);

  const api = {
    state: () => {
      const risk = listIn(site, "risk");
      const openStat = risk.querySelectorAll('[role="tab"]')[openIndex(risk)];
      return {
        beat, chapter, settled, fill,
        visible: CHAPTERS.filter((c) => parseFloat(getComputedStyle(chapterEl(site, c)).opacity) > 0.01),
        open: { why: openIndex(listIn(site, "why")), risk: openIndex(risk) },
        caption: [...site.querySelectorAll('[data-chapter="attack"] .s-caps li')].findIndex((li) => li.classList.contains("is-on")),
        lit: [...site.querySelectorAll(".eng")].map((e) => parseFloat(getComputedStyle(e).getPropertyValue("--lit")) || 0),
        statText: openStat ? openStat.querySelector("[data-stat]").textContent : null,
      };
    },
    scrollToBeat: (b, within = 0.5) => {
      const p = beatStart(b) + (within * BEATS[b].weight) / TOTAL_WEIGHT;
      window.scrollTo(0, st.start + p * (st.end - st.start));
    },
  };
  (window.__cyvoreStories ||= {})[name] = api;
  return api;
}

/** Reduced motion: no pin, no scrub. Four still copies of the site, each on its chapter, fully open. */
export function mountStatic(story, name) {
  const site = story.querySelector(".site");
  story.classList.add("is-static");
  const copies = CHAPTERS.map((ch, idx) => {
    const copy = site.cloneNode(true);
    showOnly(copy, ch);
    copy.querySelectorAll(".chap[data-go]").forEach((c) => {
      const on = c.dataset.go === ch;
      c.setAttribute("aria-selected", String(on));
      c.style.setProperty("--fill", on ? "1" : "0");
    });
    copy.querySelector("[data-where]").textContent = `Chapter ${idx + 1} of ${CHAPTERS.length}`;
    if (ch === "why" || ch === "risk") openPanel(listIn(copy, ch), 0, { instant: true });
    if (ch === "attack") copy.querySelectorAll(".s-caps li").forEach((li) => li.classList.add("is-on"));
    if (ch === "powers") powersTimeline(copy).progress(1);
    bindPanels(copy, { instant: true });
    return copy;
  });
  copies.forEach((copy) => copy.querySelectorAll(".chap[data-go]").forEach((c) => {
    c.addEventListener("click", () => copies[CHAPTERS.indexOf(c.dataset.go)].scrollIntoView({ block: "center" }));
  }));
  site.replaceWith(...copies);
  (window.__cyvoreStories ||= {})[name] = { state: () => ({ static: true, copies: copies.length }) };
}

/* ---------- boot ---------- */

function boot() {
  const stories = [...document.querySelectorAll(".story[data-story]")];
  // The phone shows the same site: copy it in before anything mutates it.
  stories.filter((s) => s.dataset.clone).forEach((story) => {
    const src = document.querySelector(`.story[data-story="${story.dataset.clone}"] .site`);
    const copy = src.cloneNode(true);
    copy.classList.add("is-phone");
    story.querySelector(".story-pin").append(copy);
  });
  stories.forEach((story) => (reduce ? mountStatic : mountStory)(story, story.dataset.story));
  if (!reduce) ScrollTrigger.refresh();
}

document.fonts.ready.then(boot);
