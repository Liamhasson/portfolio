import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import { SNAPSHOT_KEEP, heroOnly } from "./hero-only";

/** A stand-in for the Cyvore /b/ page: its own script listens the way the real one does (index.html ~line 906). */
const PAGE = `<!doctype html><html><head><title>Cyvore</title></head><body>
<nav><a class="logo" href="#">Cyvore</a><a class="navlink" href="scan.html">ScanMySMS</a></nav>
<section id="hero"><a class="btn" id="cta" href="meeting.html">Request a meeting</a></section>
<script>
  window.hits = [];
  const f = (e) => window.hits.push(e.type);
  addEventListener('wheel', f, { passive: true });
  addEventListener('keydown', f);
  addEventListener('touchmove', f, { passive: true });
  addEventListener('scroll', f);
  document.addEventListener('click', f);
</script>
</body></html>`;

function load(html: string) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/cyvore-new/site/index.html" });
  const w = dom.window as unknown as Window & { hits: string[] };
  return { w, doc: dom.window.document };
}

describe("heroOnly", () => {
  test("injects one script and one style before the page's first script", () => {
    const out = heroOnly(PAGE);
    expect(out.match(/<script data-hero-only>/g)).toHaveLength(1);
    expect(out.match(/<style data-hero-only>/g)).toHaveLength(1);
    expect(out.indexOf("<script data-hero-only>")).toBeLessThan(out.indexOf("<script>\n  window.hits"));
  });

  test("the page can't scroll and nothing looks clickable", () => {
    const out = heroOnly(PAGE);
    const style = out.match(/<style data-hero-only>([\s\S]*?)<\/style>/)![1];
    expect(style).toMatch(/html,\s*body\s*\{\s*overflow:\s*hidden\s*!important;?\s*\}/);
    expect(style).toMatch(/a,\s*button,\s*\[role="button"\]\s*\{\s*cursor:\s*default\s*!important;?\s*\}/);
  });

  test("wheel, scroll keys, touch drags and clicks never reach the page's own listeners", () => {
    const { w, doc } = load(heroOnly(PAGE));
    w.dispatchEvent(new w.WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true }));
    for (const key of ["ArrowDown", "PageDown", " ", "End", "Enter"]) {
      doc.body.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    }
    doc.body.dispatchEvent(new w.Event("touchmove", { bubbles: true, cancelable: true }));
    const click = new w.MouseEvent("click", { bubbles: true, cancelable: true });
    doc.getElementById("cta")!.dispatchEvent(click);
    expect(w.hits).toEqual([]);
    expect(click.defaultPrevented).toBe(true);
  });

  test("Tab still moves focus (only the keys that scroll or activate are held)", () => {
    const { w, doc } = load(heroOnly(PAGE));
    const tab = new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    doc.body.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  test("patching twice injects once", () => {
    const out = heroOnly(heroOnly(PAGE));
    expect(out.match(/<script data-hero-only>/g)).toHaveLength(1);
    expect(out.match(/<style data-hero-only>/g)).toHaveLength(1);
  });

  test("a page with no script isn't the page we expect", () => {
    expect(() => heroOnly("<html><body>hi</body></html>")).toThrow(/script/i);
  });
});

describe("SNAPSHOT_KEEP", () => {
  const kept = (p: string) => SNAPSHOT_KEEP.some((r) => r.test(p));
  test.each([
    "index.html", "overlays.js", "overlays.css", "pages.css", "pages.js",
    "hero-v2-2k.mp4", "hero-v2-2k.jpg", "hero-v2-phone-2k.mp4", "hero-v2-phone-2k.jpg",
    "layers/sky-ext.jpg", "assets/logo/x.svg",
  ])("keeps %s", (p) => expect(kept(p)).toBe(true));
  test.each(["scene/room-v2-2k.mp4", "about.html", "meeting.html", "press.html", "scan.html"])("leaves out %s", (p) =>
    expect(kept(p)).toBe(false));
});
