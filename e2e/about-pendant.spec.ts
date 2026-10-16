// e2e/about-pendant.spec.ts: the pendant on About (plan 2026-10-16-about-pendant Task 7; Task 8 adds the readability sweep).
// Run with `npx playwright test -c playwright.about.config.ts` (a GPU-backed Chromium: the pendant is WebGL2).
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page, timeout = 10_000) => page.waitForFunction(() => window.__pendant?.ready === true, null, { timeout });

test("the pendant draws on About with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/about");
  const canvas = page.locator("canvas.ab-pendant");
  await expect(canvas).toBeVisible();
  await ready(page);
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
  expect(errors).toEqual([]);
});

test("About works when the pendant's model fails", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
