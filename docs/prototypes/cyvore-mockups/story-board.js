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
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, k) => {
    t.setAttribute("aria-selected", String(k === i));
    t.tabIndex = k === (i ?? 0) ? 0 : -1;
  });
  if (i === null) return;
  const num = tabs[i].querySelector("[data-stat]");
  if (num) countUp(num, instant);
}

/** Hover (mouse only, after a beat), click/tap and arrow keys, as on the live site. */
export function bindPanels(root, { instant = false } = {}) {
  root.querySelectorAll('.panels[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const vertical = !!list.closest(".is-phone");
    let timer = 0;
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => openPanel(list, i, { instant }));
      t.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        clearTimeout(timer);
        timer = setTimeout(() => openPanel(list, i, { instant }), reduce ? 0 : 90);
      });
      t.addEventListener("pointerleave", () => clearTimeout(timer));
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
    c.tabIndex = ch === current ? 0 : -1;
    c.style.setProperty("--fill", fill[ch].toFixed(3));
    c.toggleAttribute("data-done", fill[ch] >= 1 && ch !== current);
  });
  return fill;
}

/* ---------- a story ---------- */

export function mountStory(story, name) {
  const track = story.querySelector(".story-track");
  const pin = story.querySelector(".story-pin");
  const site = story.querySelector(".site");
  const where = site.querySelector("[data-where]");

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

  const applyBeat = (b, instant) => {
    const B = BEATS[b];
    if (B.chapter === "why" || B.chapter === "risk") openPanel(listIn(site, B.chapter), B.panel, { instant });
  };

  const goTo = (b, dir, instant = false) => {
    const next = BEATS[b].chapter;
    if (next !== chapter) {
      const from = chapter;
      chapter = next;
      where.textContent = `Chapter ${CHAPTERS.indexOf(next) + 1} of ${CHAPTERS.length}`;
      // A new handover finishes the running one first, so chapters never stack up.
      if (tl) { tl.progress(1).kill(); tl = null; }
      if (!from || instant || reduce) {
        showOnly(site, next);
        applyBeat(b, true);
        settled = true;
      } else {
        settled = false;
        const out = chapterEl(site, from);
        const inn = chapterEl(site, next);
        const y = dir > 0 ? -16 : 16;
        CHAPTERS.forEach((c) => {
          if (c === from || c === next) return;
          const el = chapterEl(site, c);
          el.classList.remove("is-on");
          el.inert = true;
          gsap.set(el, { autoAlpha: 0, y: 0 });
        });
        out.inert = true;
        inn.inert = false;
        tl = gsap.timeline({ onComplete: () => { settled = true; tl = null; } })
          .to(out, { autoAlpha: 0, y, duration: 0.36, ease: "power2.in" })
          .call(() => { out.classList.remove("is-on"); gsap.set(out, { y: 0 }); inn.classList.add("is-on"); applyBeat(b, false); })
          .fromTo(inn, { autoAlpha: 0, y: -y }, { autoAlpha: 1, y: 0, duration: 0.52, ease: SETTLE });
      }
    } else {
      applyBeat(b, instant);
    }
    beat = b;
  };

  const update = (progress, dir) => {
    const { beat: b, within } = beatAt(progress);
    if (b !== beat) goTo(b, dir || (b > beat ? 1 : -1));
    fill = setBar(site, b, within);
  };

  const st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${pinTop()}px`,
    end: () => `bottom ${pinTop() + pin.offsetHeight}px`,
    invalidateOnRefresh: true,
    onRefreshInit: layout,
    onUpdate: (self) => update(self.progress, self.direction),
  });

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

/* ---------- boot ---------- */

function boot() {
  document.querySelectorAll(".story[data-story]").forEach((story) => mountStory(story, story.dataset.story));
  ScrollTrigger.refresh();
}

document.fonts.ready.then(boot);
