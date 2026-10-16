// src/app/about/loops.ts: the loops among About's pictures play only while you can see them (spec 2026-10-16-about-pictures-design.md §2)

type Loop = { el: HTMLVideoElement; seen: boolean; shown: boolean; failed: boolean; playing: boolean; onError: () => void };

/**
 * Starts and stops the silent loops. A loop plays only when ALL of these hold, and is paused the moment one stops:
 *  - it is on screen (an IntersectionObserver on the video, threshold 0: it flips on the first visible pixel. Chromium counts the track's clip-path in it, so a picture fully cut away or not yet risen is not on screen, but one that has begun to rise or to be cut already is);
 *  - its picture is not cut away or waiting to rise (`setShown`, from the state the track's frame already computes: no second measure);
 *  - the tab is visible (`document.hidden`) and the visitor has not asked for reduced motion (`prefers-reduced-motion`, also when it changes).
 * Until the first moment a loop is wanted nothing is called on it: the videos are `preload="none"`, and play() is what starts a download,
 * so a loop off screen never downloads. Everything fails silently: a rejected play() (autoplay policy, a failed load) or a video `error`
 * leaves the poster, logs nothing, and (after an error) is not retried. Without IntersectionObserver nothing plays: the posters stay.
 * Returns `setShown(video, shown)` (the frame tells it which pictures are cut away) and `destroy()`.
 */
export function watchLoops(videos: HTMLVideoElement[]) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const loops = new Map<Element, Loop>();
  const sync = (l: Loop) => {
    const want = !l.failed && l.seen && l.shown && !document.hidden && !mq.matches;
    if (want === l.playing) return;
    l.playing = want;
    if (!want) { try { l.el.pause(); } catch { /* nothing to say */ } return; }
    try {
      // (play() may return nothing in an old browser; a rejection, of a refused or an aborted play, is not worth a word)
      // (a late rejection, e.g. the AbortError of a pause, must not flip a loop that has been started again since: only when it really is not playing)
      void l.el.play()?.catch(() => { if (l.el.paused) l.playing = false; });
    } catch { l.playing = false; }
  };
  const syncAll = () => loops.forEach(sync);
  for (const el of videos) {
    const l: Loop = { el, seen: false, shown: true, failed: false, playing: false, onError: () => { l.failed = true; sync(l); } };
    el.addEventListener("error", l.onError);
    loops.set(el, l);
  }
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      const l = loops.get(e.target);
      if (l) { l.seen = e.isIntersecting; sync(l); }
    }))
    : null;
  videos.forEach((el) => io?.observe(el));
  document.addEventListener("visibilitychange", syncAll);
  mq.addEventListener?.("change", syncAll);
  return {
    setShown(el: HTMLVideoElement | null, shown: boolean) {
      const l = el && loops.get(el);
      if (l && l.shown !== shown) { l.shown = shown; sync(l); }
    },
    destroy() {
      io?.disconnect();
      document.removeEventListener("visibilitychange", syncAll);
      mq.removeEventListener?.("change", syncAll);
      loops.forEach((l) => { l.el.removeEventListener("error", l.onError); l.seen = false; sync(l); });
      loops.clear();
    },
  };
}
