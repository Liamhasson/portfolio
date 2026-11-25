/**
 * The Cyvore new website's /b/ page, held on its hero (spec 2026-11-25 §3): the teaser frames only the first screen,
 * so the page must never scroll on into its story, and nothing in it may lead away (its pages and overlays aren't in
 * the snapshot). Injected before the page's own script, so these capture listeners on window run first and the page's
 * own (its scroll pull, overlays.js) never hear the event. The cursor still moves over the art (pointermove is left).
 * Used by scripts/cyvore-new-snapshot.mjs.
 */

const STYLE = `<style data-hero-only>
html, body { overflow: hidden !important; }
a, button, [role="button"] { cursor: default !important; }
#hint { display: none !important; }
</style>`;

// Scrolling input is only kept from the page's listeners, never cancelled: inside an iframe a cancelled wheel or swipe
// is lost to the portfolio page around it too, and overflow:hidden already holds the hero (final review #1). Clicks,
// submits and Enter are cancelled (they'd follow links). Messages never reach the page: its overlays.js would follow
// any href posted to it, on the portfolio's origin (final review #3).
const SCRIPT = `<script data-hero-only>
(() => {
  const opt = { capture: true, passive: false };
  const keep = (e) => e.stopImmediatePropagation();
  const stop = (e) => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
  for (const t of ["wheel", "touchstart", "touchmove", "message"]) addEventListener(t, keep, opt);
  for (const t of ["click", "auxclick", "dblclick", "submit"]) addEventListener(t, stop, opt);
  const scrollKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"]);
  addEventListener("keydown", (e) => { if (e.key === "Enter") stop(e); else if (scrollKeys.has(e.key)) keep(e); }, opt);
  addEventListener("pointerdown", (e) => { if (e.target instanceof Element && e.target.closest("a, button, [role=button]")) stop(e); }, opt);
  addEventListener("load", () => scrollTo(0, 0));
})();
</script>`;

export function heroOnly(html: string): string {
  if (html.includes("<script data-hero-only>")) return html;
  const at = html.indexOf("<script");
  if (at < 0) throw new Error("heroOnly: no <script> in the page; this isn't the Cyvore /b/ page");
  return html.slice(0, at) + STYLE + "\n" + SCRIPT + "\n" + html.slice(at);
}

/** The files of public/b the first screen needs: the page, its code, the hero's films and stills, its layers and
 *  assets. Not scene/ (the story below the hero, 31 MB) nor the other pages. */
export const SNAPSHOT_KEEP: readonly RegExp[] = [
  /^index\.html$/,
  /^(overlays|pages)\.(js|css)$/,
  /^hero-v2(-phone)?-2k\.(mp4|jpg)$/,
  /^layers\//,
  /^assets\//,
];
