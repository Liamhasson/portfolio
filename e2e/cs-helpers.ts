import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export const STUDIES = ["eventread", "cyvore", "pulse", "nordic-logic", "marni-came"] as const;

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}

export async function expectNoSeriousA11y(page: Page) {
  const { violations } = await new AxeBuilder({ page }).include("article[data-world]").analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** One board unit in px inside a section: a probe 100 units wide, measured. */
export async function unitPx(section: Locator) {
  return section.evaluate((el) => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:calc(var(--u) * 100);height:1px";
    el.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w / 100;
  });
}

export async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

/** Spec §7 budget, first view without scrolling: the LCP image's bytes, all image bytes, and any video fetched
    whose element starts more than 1.5 viewports down. */
export async function firstViewBudget(page: Page) {
  await page.waitForLoadState("networkidle");
  return page.evaluate(async () => {
    const lcpUrl = await new Promise<string>((resolve) => {
      new PerformanceObserver((list) => {
        const e = list.getEntries().at(-1) as PerformanceEntry & { url?: string };
        resolve(e?.url ?? "");
      }).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => resolve(""), 1500);
    });
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const isImage = (r: PerformanceResourceTiming) => r.initiatorType === "img" || /\/_next\/image|\.(png|jpe?g|webp|avif)(\?|$)/.test(r.name);
    const lcp = res.find((r) => lcpUrl && r.name === new URL(lcpUrl, location.href).href);
    const videos = [...document.querySelectorAll("video")];
    const earlyVideos = res.filter((r) => /\.mp4(\?|$)/.test(r.name)).map((r) => r.name).filter((name) => {
      const v = videos.find((el) => el.currentSrc === name || el.src === name);
      return !v || v.getBoundingClientRect().top > innerHeight * 1.5;
    });
    return { lcpBytes: lcp?.encodedBodySize ?? 0, imageBytes: res.filter(isImage).reduce((a, r) => a + r.encodedBodySize, 0), earlyVideos };
  });
}

/** Spec text floors: nothing visible under 11px outside product visuals (CSS keeps body ≥ 15px). */
export async function expectTextFloors(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("article[data-world]")!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (!n.textContent!.trim() || el.closest("[data-product],[aria-hidden='true'],.sr-only")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) out.push(`${size.toFixed(1)}px: ${n.textContent!.trim().slice(0, 40)}`);
    }
    return out;
  });
  expect(small).toEqual([]);
}
