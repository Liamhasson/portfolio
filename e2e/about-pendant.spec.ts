// e2e/about-pendant.spec.ts: the pendant on About (plan 2026-10-16-about-pendant Task 7; Task 8 adds the readability sweep).
// Run with `npx playwright test -c playwright.about.config.ts` (a GPU-backed Chromium: the pendant is WebGL2).
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page, timeout = 10_000) => page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout });

/** Page errors and console errors; `ignore` drops the browser's own lines for requests a test aborts on purpose. */
function collectErrors(page: Page, ignore?: RegExp): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !(ignore && ignore.test(m.text()))) errors.push(m.text()); });
  return errors;
}

/** Bright (brass) pixels in a screen box: the page's own background there is near black. */
async function brightPixels(page: Page, box: { l: number; t: number; r: number; b: number }) {
  const clip = { x: Math.max(0, box.l), y: Math.max(0, box.t), width: Math.max(1, box.r - Math.max(0, box.l)), height: Math.max(1, box.b - Math.max(0, box.t)) };
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 150) n++;
    return n;
  }, png);
}

test("the pendant draws on About with no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  const canvas = page.locator("canvas.ab-pendant");
  await expect(canvas).toBeVisible();
  await ready(page);
  await page.mouse.move(1430, 890);
  const hook = await page.evaluate(() => window.__pendant!);
  expect(hook.keys.map((k) => k.id)).toEqual([
    "opening", "letgo", "tumble", "worm", "above", "glass", "glide", "glideEnd", "whirl", "build", "buildEnd", "hero",
  ]);
  for (let i = 1; i < hook.keys.length; i++) expect(hook.keys[i].y).toBeGreaterThan(hook.keys[i - 1].y);
  // the opening: small, above the first line, in front of the words
  expect(hook.layer).toBe("front");
  expect(hook.box.r - hook.box.l).toBeGreaterThan(20);
  expect(hook.box.b - hook.box.t).toBeGreaterThan(60);
  await expect(canvas).toHaveAttribute("data-layer", "front");
  // real pixels: brass in its box (above the first line, no words there), and none once the canvas is hidden
  await page.waitForTimeout(900); // (its 0.6 s fade-in)
  const drawn = await brightPixels(page, hook.box);
  await canvas.evaluate((c) => { c.style.visibility = "hidden"; });
  const without = await brightPixels(page, hook.box);
  await canvas.evaluate((c) => { c.style.visibility = ""; });
  expect(drawn).toBeGreaterThan(500);
  expect(without).toBeLessThan(drawn / 20);
  expect(errors).toEqual([]);
});

test("About works when the pendant's model fails", async ({ page }) => {
  const errors = collectErrors(page, /Failed to load resource/); // (the aborted files' own network lines)
  let aborted = 0;
  await page.route("**/about/pendant/**", (r) => { aborted++; return r.abort(); });
  await page.goto("/about");
  await expect(page.getByText("I’m Liam. I love crafting products")).toBeVisible();
  await expect.poll(() => aborted, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.locator("canvas.ab-pendant")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Find the problem." })).toBeAttached();
  expect(errors).toEqual([]);
});

test("a lost WebGL context hides the canvas without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page);
  const canvas = page.locator("canvas.ab-pendant");
  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.ab-pendant")!;
    const ext = c.getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    ext.loseContext();
  });
  await expect(canvas).toBeHidden();
  expect(await page.evaluate(() => window.__pendant!.ready)).toBe(false);
  await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
  await ready(page, 15_000);
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});

test("the glass sits in the gap between the quotes and touches neither", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/about");
  await ready(page);
  await page.mouse.move(1430, 890);
  const y = await page.evaluate(() => window.__pendant!.keys.find((k) => k.id === "glass")!.y);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(2500); // (the follow settles)
  const m = await page.evaluate(() => {
    const g = window.__pendant!.glass!;
    const q1 = document.querySelector("[data-pendant='quote1']")!.getBoundingClientRect();
    const bq = document.querySelector("[data-pendant='quote2'] blockquote")!;
    const hang = 0.6 * parseFloat(getComputedStyle(bq).fontSize);
    const cx = g.x * innerWidth, R = g.r * innerHeight;
    return { left: cx - R, right: cx + R, R, q1: q1.right, q2: bq.getBoundingClientRect().left - hang };
  });
  expect(m.R).toBeGreaterThan(20);
  expect(m.left).toBeGreaterThan(m.q1);
  expect(m.right).toBeLessThan(m.q2);
  expect(errors).toEqual([]);
});
